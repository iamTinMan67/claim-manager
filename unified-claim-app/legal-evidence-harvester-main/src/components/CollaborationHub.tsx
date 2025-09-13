import React, { useState } from 'react';
import { ChatWindow } from './ChatWindow';
import { ClaimSharingTab } from './ClaimSharingTab';

interface CollaborationHubProps {
  claimId: string;
}

export const CollaborationHub: React.FC<CollaborationHubProps> = ({ claimId }) => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <ChatWindow
        claimId={claimId}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />
    </>
  );
};