import SupportDesk from '@/components/support/SupportDesk';
import type { TicketCategory } from '@/lib/support';
export default function SupportTab(props: { forcedCategory?: TicketCategory; hideHeading?: boolean }) {
  return <div className="mx-auto max-w-6xl"><SupportDesk {...props} /></div>;
}
