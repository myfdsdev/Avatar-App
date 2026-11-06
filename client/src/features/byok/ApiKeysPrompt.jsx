import { useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { useTrainingPopup } from "@/features/dashboard/TrainingVideo";
import ApiKeysForm, { keysComplete, useByok } from "./ApiKeysForm";

/**
 * Asks for the workspace's LemonSlice and ElevenLabs keys as soon as the app
 * opens, while any is missing. "Later" hides it until the app is opened again
 * (sessionStorage), so it does not come back on every page in one visit.
 */
const DISMISSED = "byok-prompt-dismissed";

const dismissedThisVisit = () => {
  try {
    return sessionStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
};

export default function ApiKeysPrompt() {
  const { data } = useByok();
  const [dismissed, setDismissed] = useState(dismissedThisVisit);
  // The dashboard's training video goes first; this asks once it is closed.
  const trainingOpen = useTrainingPopup((s) => s.open);

  const close = () => {
    try {
      sessionStorage.setItem(DISMISSED, "1");
    } catch {
      // Private mode: it just asks again next page load.
    }
    setDismissed(true);
  };

  const open = Boolean(data) && !keysComplete(data.keys) && !dismissed && !trainingOpen;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add your API keys"
      description={
        data?.canManage
          ? "Avatars in this workspace run on your own LemonSlice and ElevenLabs accounts. Keys are checked with the vendor, stored encrypted, and never shown again."
          : "This workspace needs its own LemonSlice and ElevenLabs keys before avatars can be made or called. Ask the workspace owner to add them."
      }
    >
      <ApiKeysForm
        status={data?.keys}
        canManage={data?.canManage}
        onSaved={(keys) => keysComplete(keys) && setDismissed(true)}
        footer={
          <Button variant="ghost" type="button" onClick={close}>
            {data?.canManage ? "Later" : "OK"}
          </Button>
        }
      />
    </Modal>
  );
}
