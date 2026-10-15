export type TicketStatus = 'open' | 'in_progress' | 'closed';
export type TicketCategory = 'ban_appeal' | 'complaint' | 'bug' | 'other';
export interface SupportTicket {
  id: string; user_id: string; category: TicketCategory; subject: string;
  status: TicketStatus; created_at: string; updated_at: string;
}
export interface SupportMessage {
  id: string; ticket_id: string; author_user_id: string; author_username: string;
  is_staff_reply: boolean; message: string; created_at: string;
}
export const ticketCategories: Record<TicketCategory, string> = {
  ban_appeal: 'Бан-апелляция', complaint: 'Жалоба', bug: 'Ошибка игры', other: 'Другой вопрос',
};
export const ticketStatuses: Record<TicketStatus, string> = { open: 'Открыт', in_progress: 'В работе', closed: 'Закрыт' };
export function ticketsForFolder(tickets: SupportTicket[], folder: string) {
  return tickets.filter(ticket => folder === 'active' ? ticket.status !== 'closed' : ticket.status === folder);
}
