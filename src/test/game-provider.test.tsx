import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from '@/context/GameContext';
import { applyGameAction, createGameState, type GameAction } from '@/game/engine';
const mocks = vi.hoisted(() => ({ user: null as {id: string} | null, invoke: vi.fn(), from: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke }, from: mocks.from } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
function Probe() {
  const game = useGame();
  return <><output data-testid="balance">{game.balance}</output><output data-testid="power">{game.clickPower}</output><button onClick={() => { for(let i=0;i<5;i++)game.click(); }}>Click five</button><button onClick={() => game.buyUpgrade('click-power')}>Upgrade</button><button onClick={() => { void game.syncProgress().catch(() => undefined); }}>Sync</button></>;
}
beforeEach(() => { localStorage.clear(); mocks.user=null; mocks.invoke.mockReset(); mocks.from.mockReset(); mocks.from.mockReturnValue({select: () => ({eq: () => ({maybeSingle: async () => ({data:{game_state:createGameState({balance:100})},error:null})})})}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('provider persistence', () => {
  it('applies rapid local actions to the latest balance and restores the resulting save', () => {
    vi.spyOn(Date,'now').mockReturnValue(Date.UTC(2026,9,2));
    localStorage.setItem('gameState_guest',JSON.stringify(createGameState({balance:1000})));
    const first=render(<GameProvider><Probe/></GameProvider>);
    fireEvent.click(screen.getByText('Click five'));fireEvent.click(screen.getByText('Upgrade'));
    expect(screen.getByTestId('balance').textContent).toBe('955');
    expect(screen.getByTestId('power').textContent).toBe('2');
    first.unmount();render(<GameProvider><Probe/></GameProvider>);
    expect(screen.getByTestId('balance').textContent).toBe('955');
    expect(screen.getByTestId('power').textContent).toBe('2');
  });
  it('loads the existing cloud save and journals clicks when the sync function is missing', async () => {
    mocks.user={id:'offline-account'};
    mocks.invoke.mockResolvedValue({data:null,error:Object.assign(new Error('Function missing'), {context:{status:404}})});
    const first=render(<GameProvider><Probe/></GameProvider>);
    await screen.findByText('Click five');
    expect(screen.getByTestId('balance').textContent).toBe('100');
    fireEvent.click(screen.getByText('Click five'));
    expect(screen.getByTestId('balance').textContent).toBe('105');
    expect(JSON.parse(localStorage.getItem('gameJournal_offline-account')!).pending).toHaveLength(5);
    first.unmount();render(<GameProvider><Probe/></GameProvider>);
    await screen.findByText('Click five');
    expect(screen.getByTestId('balance').textContent).toBe('105');
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('blocks clicks after an authorization denial', async () => {
    mocks.user={id:'denied-account'};
    mocks.invoke.mockResolvedValue({data:null,error:Object.assign(new Error('Forbidden'), {context:{status:403}})});
    render(<GameProvider><Probe/></GameProvider>);await screen.findByText('Click five');
    fireEvent.click(screen.getByText('Click five'));
    expect(screen.getByTestId('balance').textContent).toBe('100');
  });
  it('keeps a journal after a lost reply and replays acknowledged clicks without double payment', async () => {
    mocks.user={id:'test-account'};
    let server=createGameState({balance:100});const received=new Set<string>();let calls=0;
    mocks.invoke.mockImplementation(async (_name:string,{body}:{body:{actions:GameAction[]}}) => {
      for(const action of body.actions){if(!received.has(action.id)){server=applyGameAction(structuredClone(server),action);received.add(action.id);}}
      calls++;
      if(calls===2)return {data:null,error:new Error('Response lost after commit')};
      return {data:{state:server,acknowledged:body.actions.map(a=>a.id),rejected:[]},error:null};
    });
    const first=render(<GameProvider><Probe/></GameProvider>);
    await screen.findByText('Click five');
    fireEvent.click(screen.getByText('Click five'));
    await act(async () => {fireEvent.click(screen.getByText('Sync'));});
    await screen.findByText(/Синхронизация приостановлена/);
    expect(server.balance).toBe(105);
    expect(JSON.parse(localStorage.getItem('gameJournal_test-account')!).pending).toHaveLength(5);
    first.unmount();render(<GameProvider><Probe/></GameProvider>);
    await screen.findByText('Click five');
    await waitFor(() => expect(screen.getByTestId('balance').textContent).toBe('105'));
    expect(server.balance).toBe(105);
    expect(JSON.parse(localStorage.getItem('gameJournal_test-account')!).pending).toEqual([]);
  });
});
