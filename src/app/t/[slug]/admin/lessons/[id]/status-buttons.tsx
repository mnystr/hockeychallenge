import {
  publishLesson,
  unpublishLesson,
  archiveLesson,
  softDeleteLesson,
} from "../actions";

export type LessonStatusButtonsStrings = {
  publish: string;
  unpublish: string;
  archive: string;
  move_to_draft: string;
  delete: string;
};

export default function LessonStatusButtons({
  slug,
  lessonId,
  status,
  strings,
}: {
  slug: string;
  lessonId: string;
  status: string;
  strings: LessonStatusButtonsStrings;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <form
          action={async () => {
            "use server";
            await publishLesson(slug, lessonId);
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
              await unpublishLesson(slug, lessonId);
            }}
          >
            <button className="btn btn-secondary btn-sm">
              {strings.unpublish}
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await archiveLesson(slug, lessonId);
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
            await unpublishLesson(slug, lessonId);
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
          await softDeleteLesson(slug, lessonId);
        }}
      >
        <button className="btn btn-danger btn-sm">{strings.delete}</button>
      </form>
    </div>
  );
}
