import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { coverStyle } from "@/lib/covers";
import { ReadOnlyEditorClient } from "./ReadOnlyEditorClient";

type Params = { params: Promise<{ pageId: string }> };

async function getPublicPage(pageId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  return page && page.isPublic && !page.deletedAt ? page : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = await getPublicPage((await params).pageId);
  return { title: page ? `${page.icon ? `${page.icon} ` : ""}${page.title}` : "Page not found" };
}

export default async function PublicPage({ params }: Params) {
  const page = await getPublicPage((await params).pageId);
  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-full bg-white">
      {page.cover && <div className="h-[30vh] max-h-[280px] min-h-[140px] w-full" style={coverStyle(page.cover)} />}
      <div className={`mx-auto w-full max-w-[816px] px-6 pb-24 sm:px-[54px] ${page.cover ? "" : "pt-20"}`}>
        {page.icon && <div className={`text-[72px] leading-none ${page.cover ? "relative -mt-[42px]" : ""}`}>{page.icon}</div>}
        <h1 className="mt-4 text-[40px] leading-[1.2] font-bold text-ink">{page.title}</h1>
        <div className="notion-editor mt-3 sm:-mx-[54px]">
          <ReadOnlyEditorClient content={page.content} />
        </div>
      </div>
    </div>
  );
}
