import {
  publishChallenge,
  unpublishChallenge,
  archiveChallenge,
  softDeleteChallenge,
} from "../actions";

export type ChallengeStatusButtonsStrings = {
  publish: string;
  unpublish: string;
  archive: string;
  move_to_draft: string;
  delete: string;
};

export default function ChallengeStatusButtons({
  slug,
  challengeId,
  status,
  strings,
}: {
  slug: string;
  challengeId: string;
  status: string;
  strings: ChallengeStatusButtonsStrings;
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
          <button className="btn btn-primary btn-sm">{strings.publish}</button>
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
            <button className="btn btn-secondary btn-sm">
              {strings.unpublish}
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await archiveChallenge(slug, challengeId);
            }}
          >
            <button className="btn btn-secondary btn-sm">
              {strings.archive}
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
          <button className="btn btn-secondary btn-sm">
            {strings.move_to_draft}
          </button>
        </form>
      )}
      <form
        action={async () => {
          "use server";
          await softDeleteChallenge(slug, challengeId);
        }}
      >
        <button className="btn btn-danger btn-sm">{strings.delete}</button>
      </form>
    </div>
  );
}
