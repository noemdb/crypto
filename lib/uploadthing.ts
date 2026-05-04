import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  exportUploader: f({ blob: { maxFileSize: "16MB" } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(({ metadata, file }) => {
      console.info(
        `[uploadthing] export uploaded userId=${metadata.userId} url=${file.url}`,
      );
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
