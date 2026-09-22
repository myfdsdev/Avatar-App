import PortraitCall from "@/features/call/PortraitCall";

/**
 * The Chat tab: the same portrait call as the call page, without leaving the
 * avatar's settings behind.
 */
export default function AvatarChat({ avatar }) {
  return (
    <div className="flex justify-center px-6 pb-10 pt-2">
      <PortraitCall avatar={avatar} />
    </div>
  );
}
