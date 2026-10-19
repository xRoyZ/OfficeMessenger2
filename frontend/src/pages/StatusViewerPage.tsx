import { useParams } from 'react-router-dom';
import { StatusViewer } from '../features/status/StatusViewer';

export default function StatusViewerPage() {
  const { statusId } = useParams<{ statusId: string }>();

  return <StatusViewer statusId={statusId} />;
}
