import { useMindMapStore } from '../stores/mindmapStore';
import MindMapView from '../components/MindMap/MindMapView';
import ChatPanel from '../components/Chat/ChatPanel';
import './MapEditor.css';

export default function MapEditor() {
  const { isChatOpen } = useMindMapStore();

  return (
    <div className="editor-page">
      <div className="editor-map-area">
        <MindMapView />
      </div>
      {isChatOpen && <ChatPanel />}
    </div>
  );
}
