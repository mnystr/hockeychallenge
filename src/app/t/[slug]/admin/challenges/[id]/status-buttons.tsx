import {
  publishChallenge,
  unpublishChallenge,
  archiveChallenge,
  softDeleteChallenge,
} from "../actions";

export default function ChallengeStatusButtons({
  slug,
  challengeId,
  status,
}: {
  slug: string;
  challengeId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <form
          action={async () => {
            "use server";
            await publishChallenge(slug, challengeId);
          }}
        >
          <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Publish
          </button>
        </form>
      )}
      {status === "published" && (
        <>
          <form
            action={async () => {
              "use server";
              await unpublishChallenge(slug, challengeId);
            }}
          >
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              Unpublish
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await archiveChallenge(slug, challengeId);
            }}
          >
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              Archive
            </button>
          </form>
        </>
      )}
      {status === "archived" && (
        <form
          action={async () => {
            "use server";
            await unpublishChallenge(slug, challengeId);
          }}
        >
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Move back to draft
          </button>
        </form>
      )}
      <form
        action={async () => {
          "use server";
          await softDeleteChallenge(slug, challengeId);
        }}
      >
        <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
          Delete
        </button>
      </form>
    </div>
  );
}
