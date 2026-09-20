"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { Composer, MessageBubble } from "@/components/domain/chat";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import {
  conversationKeys,
  listMessages,
  moderateMessage,
  sendMessage,
  type AdminMessage,
  type ConversationDetail,
  type MessagesPage,
  type ModerationAction,
} from "@/lib/api/messaging";
import { intlLocale } from "@/lib/utils/format";

type Pages = InfiniteData<MessagesPage, string | undefined>;

/** Replaces (or appends) a message in the cached pages. */
export function upsertMessage(
  data: Pages | undefined,
  message: AdminMessage,
  append = false,
): Pages | undefined {
  if (!data) return data;
  let found = false;
  const pages = data.pages.map((p) => ({
    ...p,
    data: p.data.map((m) => {
      if (m.id !== message.id) return m;
      found = true;
      return message;
    }),
  }));
  if (!found && append && pages.length > 0) {
    // pages[0] is the newest page
    pages[0] = { ...pages[0], data: [...pages[0].data, message] };
  }
  return { ...data, pages };
}

/** One message with Hide / Unhide (immediate, Undo toast) and Delete (confirm). */
export function ModeratedMessage({
  message,
  side,
  onChange,
}: {
  message: AdminMessage;
  side: "start" | "end";
  onChange: (m: AdminMessage) => void;
}) {
  const t = useTranslations("inbox.moderation");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const moderate = useMutation({
    mutationFn: ({ action }: { action: ModerationAction }) => moderateMessage(message.id, action),
    onMutate: ({ action }) => {
      if (action !== "delete") onChange({ ...message, status: action === "hide" ? "hidden" : "visible" });
    },
    onSuccess: (m, { action }) => {
      onChange(m);
      if (action === "hide") {
        toast.success(t("hidden"), {
          action: {
            label: t("undo"),
            onClick: () => void moderateMessage(m.id, "unhide").then(onChange, (e) => toast.apiError(e)),
          },
        });
      } else if (action === "unhide") toast.success(t("unhidden"));
    },
    onError: (e) => {
      onChange(message);
      toast.apiError(e);
    },
  });

  return (
    <>
      <MessageBubble
        message={{ ...message, side }}
        pending={moderate.isPending}
        onModerate={
          message.kind === "system"
            ? undefined
            : (action) => (action === "delete" ? setConfirmDelete(true) : moderate.mutate({ action }))
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        impact={[t("deleteImpact1"), t("deleteImpact2")]}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          const m = await moderateMessage(message.id, "delete");
          onChange(m);
          toast.success(t("deleted"));
        }}
      />
    </>
  );
}

/** Messages of a conversation (cursor pages, day separators) + composer. */
export function Thread({
  conversation: c,
  closedSlot,
  send,
  placeholder,
  moderation = true,
}: {
  conversation: ConversationDetail;
  closedSlot?: React.ReactNode;
  /** Custom send endpoint (DSP-02 writes through `POST /admin/disputes/:id/messages`). */
  send?: (body: string) => Promise<AdminMessage>;
  placeholder?: string;
  /** Hide / delete buttons on messages (MSG-01); off in the dispute chat. */
  moderation?: boolean;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const key = conversationKeys.messages(c.id);
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => listMessages(c.id, { before: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextBefore ?? undefined) : undefined),
  });
  const scroller = useRef<HTMLDivElement>(null);
  const messages = (query.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((p) => p.data);
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const update = (m: AdminMessage) => queryClient.setQueryData<Pages>(key, (d) => upsertMessage(d, m));

  const sideOf = (m: AdminMessage): "start" | "end" => {
    if (!m.sender) return "start";
    if (m.sender.role === "admin") return "end";
    const p = c.participants.find((x) => x.id === m.sender!.id);
    return p?.role === "provider" ? "end" : "start";
  };
  const day = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(iso),
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto bg-canvas/60 px-5 py-4"
        aria-live="polite"
      >
        {query.isPending ? (
          <div className="flex justify-center py-10 text-muted">
            <Loader2 className="size-5 animate-spin" aria-label={t("loading")} />
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <div className="flex flex-col gap-3">
            {query.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {t("loadOlder")}
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="py-10 text-center text-13 text-muted">{t("noMessages")}</p>
            )}
            {messages.map((m, i) => {
              const newDay = i === 0 || messages[i - 1].createdAt.slice(0, 10) !== m.createdAt.slice(0, 10);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="py-1 text-center text-12 text-muted capitalize">{day(m.createdAt)}</div>
                  )}
                  {moderation ? (
                    <ModeratedMessage message={m} side={sideOf(m)} onChange={update} />
                  ) : (
                    <MessageBubble message={{ ...m, side: sideOf(m) }} />
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
      <Composer
        closedSlot={closedSlot}
        placeholder={placeholder ?? t("composerPlaceholder")}
        onSend={async (body) => {
          try {
            const m = send ? await send(body) : await sendMessage(c.id, body);
            queryClient.setQueryData<Pages>(key, (d) => upsertMessage(d, m, true));
            void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
          } catch (e) {
            toast.apiError(e);
            throw e;
          }
        }}
      />
    </div>
  );
}
