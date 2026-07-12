import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tags as TagsIcon, FileText, BrainCircuit } from "lucide-react";
import { api } from "../lib/api";
import type { DocumentItem, KnowledgeNote } from "../types";
import { Card, PageHeader, Pill, EmptyState } from "../components/ui";

export default function Tags() {
  const [searchParams] = useSearchParams();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get("tag"));

  useEffect(() => {
    api.documents.list().then(setDocs);
    api.notes.list().then(setNotes);
  }, []);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    docs.forEach((d) => d.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    notes.forEach((n) => n.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    return counts;
  }, [docs, notes]);

  const sortedTags = useMemo(
    () => Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b)),
    [tagCounts]
  );

  useEffect(() => {
    if (!selectedTag && sortedTags.length > 0) setSelectedTag(sortedTags[0]);
  }, [sortedTags, selectedTag]);

  const matchingDocs = selectedTag ? docs.filter((d) => d.tags.includes(selectedTag)) : [];
  const matchingNotes = selectedTag ? notes.filter((n) => n.tags.includes(selectedTag)) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <PageHeader
        title="Tags"
        subtitle="One place to browse everything you've tagged, across Documents and the Knowledge Base."
      />

      {sortedTags.length === 0 ? (
        <EmptyState
          icon={<TagsIcon size={22} />}
          title="No tags yet"
          hint="Add tags to a document or knowledge note and they'll show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Card className="md:col-span-1 p-4">
            <div className="flex flex-wrap gap-1.5">
              {sortedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    selectedTag === tag
                      ? "border-moss bg-moss-light text-moss"
                      : "border-dusk-light text-dusk hover:border-dusk"
                  }`}
                >
                  #{tag} <span className="opacity-70">({tagCounts[tag]})</span>
                </button>
              ))}
            </div>
          </Card>

          <div className="md:col-span-2 space-y-5">
            {matchingDocs.length === 0 && matchingNotes.length === 0 ? (
              <EmptyState title={`Nothing tagged #${selectedTag}`} />
            ) : (
              <>
                {matchingDocs.length > 0 && (
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-display text-base text-ink">
                      <FileText size={15} /> Documents
                    </h2>
                    <ul className="space-y-1.5">
                      {matchingDocs.map((d) => (
                        <li key={d.id}>
                          <Link
                            to={`/documents?doc=${d.id}`}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-soft hover:bg-fog hover:text-moss"
                          >
                            <span className="flex-1 truncate">{d.title}</span>
                            <Pill tone="neutral">{d.category}</Pill>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {matchingNotes.length > 0 && (
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-display text-base text-ink">
                      <BrainCircuit size={15} /> Knowledge Base
                    </h2>
                    <ul className="space-y-1.5">
                      {matchingNotes.map((n) => (
                        <li key={n.id}>
                          <Link
                            to={`/knowledge?note=${n.id}`}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-soft hover:bg-fog hover:text-moss"
                          >
                            <span className="flex-1 truncate">{n.title || "Untitled note"}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
