/**
 * Compile-time check that the hand-written module 2–13 types match the OpenAPI schema
 * (`pnpm api:types`). A mismatch fails `pnpm typecheck`.
 */
import type { ActivityLogDetail, ActivityLogItem } from "./activity-log";
import type {
  BookingDetail,
  BookingRow,
  BookingTabCounts,
  ChangePriceBody,
  ChangeStatusBody,
  CreateBookingBody,
  Invoice,
  RemindResult,
  RescheduleBody,
  UpdateBookingBody,
} from "./bookings";
import type {
  AdminMessage,
  CloseConversationBody,
  ConversationCounts,
  ConversationDetail,
  ConversationRow,
  CreateConversationBody,
  MessagesPage,
  ReadResult,
} from "./messaging";
import type { Category, Commune, CommunesImportResult, Wilaya } from "./catalog";
import type { ExportJob } from "./exports";
import type { SavedViewDto } from "./saved-views";
import type { CreatePackBody, PackDetail, PackRow, PackTabCounts, UpdatePackBody } from "./packs";
import type {
  ApproveRequestBody,
  BookProposalBody,
  CancelRequestBody,
  CreateProposalBody,
  RejectRequestBody,
  RequestChangesBody,
  RequestDetail,
  RequestRow,
  RequestTabCounts,
} from "./academic-requests";
import type {
  CloseDisputeBody,
  DisputeDetail,
  DisputeRow,
  DisputeTabCounts,
  OpenDisputeBody,
  RequestEvidenceBody,
  ResolveDisputeBody,
} from "./disputes";
import type {
  CreateFormBody,
  EditAnswersBody,
  EditableRequest,
  EmailCodeResult,
  FormDetail,
  FormRow,
  FormTabCounts,
  FormVersion,
  PublicForm,
  SaveDraftBody,
  SubmissionResult,
  SubmitFormBody,
  UpdateFormBody,
  PublicCategory,
  PublicWilaya,
  UploadResult,
} from "./forms";
import type { AdminNotification, MarkReadResult, UnreadCount } from "./notifications";
import type { NavCounts, Overview, SearchResult } from "./overview";
import type {
  ConvertReportBody,
  DeleteReviewBody,
  DismissReportBody,
  EditReviewBody,
  MessageReportsDismissed,
  ModerateReviewBody,
  ReplyDeleted,
  ReportRow,
  ReportTabCounts,
  ResolveReportBody,
  ReviewDeleted,
  ReviewDetail,
  ReviewRow,
  ReviewTabCounts,
} from "./reviews";
import type { components } from "./schema";
import type {
  AvailabilityBlock,
  AvailabilityMonth,
  CreateBlockBody,
  CreateServiceBody,
  HideServiceBody,
  Photo,
  ServiceDeleted,
  ServiceDetail,
  ServiceRow,
  ServiceTabCounts,
  UpdateServiceBody,
} from "./services";
import type { SettingItem, Settings } from "./settings";
import type {
  BlockBody,
  BlockImpact,
  BlockResult,
  BulkBody,
  BulkItemResult,
  CreateUserBody,
  PasswordResetResult,
  UpdateUserBody,
  UserDetail,
  UserNote,
  UserRow,
  UserTabCounts,
} from "./users";
import type {
  DocumentDecision,
  DocumentSlot,
  ReviewDocument,
  VerificationDetail,
  VerificationRow,
  VerificationTabCounts,
} from "./verifications";

type S = components["schemas"];
type Assignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;

export type ContractChecks = [
  Expect<Assignable<S["CategoryDto"], Category>>,
  Expect<Assignable<S["WilayaDto"], Wilaya>>,
  Expect<Assignable<S["CommuneDto"], Commune>>,
  Expect<Assignable<S["CommunesImportResultDto"], CommunesImportResult>>,
  Expect<Assignable<S["ActivityLogItemDto"], ActivityLogItem>>,
  Expect<Assignable<S["ActivityLogDetailDto"], ActivityLogDetail>>,
  Expect<Assignable<S["ExportDto"], ExportJob>>,
  Expect<Assignable<S["SavedViewDto"], SavedViewDto>>,
  Expect<Assignable<S["SettingItemDto"]["key"], SettingItem["key"]>>,
  Expect<Assignable<S["SettingsDto"]["sections"][number]["key"], Settings["sections"][number]["key"]>>,
  // module 4 — users (responses: API → UI type; bodies: UI type → API)
  Expect<Assignable<S["UserRowDto"], UserRow>>,
  Expect<Assignable<S["UserTabCountsDto"], UserTabCounts>>,
  Expect<Assignable<S["UserDetailDto"], UserDetail>>,
  Expect<Assignable<S["BlockImpactDto"], BlockImpact>>,
  Expect<Assignable<S["BlockResultDto"], BlockResult>>,
  Expect<Assignable<S["PasswordResetResultDto"], PasswordResetResult>>,
  Expect<Assignable<S["NoteDto"], UserNote>>,
  Expect<Assignable<S["BulkItemResultDto"], BulkItemResult>>,
  Expect<Assignable<CreateUserBody, S["CreateUserDto"]>>,
  // `reason` is typed `Record<string, never>` in openapi.json (missing `type: String` on the DTO) — reported upstream.
  Expect<Assignable<Omit<UpdateUserBody, "reason">, Omit<S["UpdateUserDto"], "reason">>>,
  Expect<Assignable<BlockBody, S["BlockUserDto"]>>,
  Expect<Assignable<BulkBody, S["BulkUsersDto"]>>,
  // module 5 — verification
  Expect<Assignable<S["VerificationRowDto"], VerificationRow>>,
  Expect<Assignable<S["VerificationTabCountsDto"], VerificationTabCounts>>,
  Expect<Assignable<S["DocumentDto"], ReviewDocument>>,
  Expect<Assignable<S["DocumentSlotDto"], DocumentSlot>>,
  Expect<Assignable<S["VerificationDetailDto"], VerificationDetail>>,
  Expect<Assignable<S["DocumentDecisionDto"], DocumentDecision>>,
  // module 6 — services & availability
  Expect<Assignable<S["ServiceRowDto"], ServiceRow>>,
  Expect<Assignable<S["ServiceTabCountsDto"], ServiceTabCounts>>,
  Expect<Assignable<S["ServiceDetailDto"], ServiceDetail>>,
  Expect<Assignable<S["PhotoDto"], Photo>>,
  Expect<Assignable<S["ServiceDeletedDto"], ServiceDeleted>>,
  Expect<Assignable<S["AvailabilityMonthDto"], AvailabilityMonth>>,
  Expect<Assignable<S["AvailabilityBlockDto"], AvailabilityBlock>>,
  Expect<Assignable<CreateServiceBody, S["CreateServiceDto"]>>,
  Expect<Assignable<UpdateServiceBody, S["UpdateServiceDto"]>>,
  Expect<Assignable<HideServiceBody, S["HideServiceDto"]>>,
  Expect<Assignable<CreateBlockBody, S["CreateAvailabilityBlockDto"]>>,
  // module 7 — Ready Packs
  Expect<Assignable<S["PackRowDto"], PackRow>>,
  Expect<Assignable<S["PackTabCountsDto"], PackTabCounts>>,
  Expect<Assignable<S["PackDetailDto"], PackDetail>>,
  Expect<Assignable<CreatePackBody, S["CreatePackDto"]>>,
  Expect<Assignable<UpdatePackBody, S["UpdatePackDto"]>>,
  // module 8 — bookings & invoices
  Expect<Assignable<S["BookingRowDto"], BookingRow>>,
  Expect<Assignable<S["BookingTabCountsDto"], BookingTabCounts>>,
  Expect<Assignable<S["BookingDetailDto"], BookingDetail>>,
  Expect<Assignable<S["InvoiceDto"], Invoice>>,
  Expect<Assignable<S["RemindResultDto"], RemindResult>>,
  // openapi.json quirks (reported upstream): `locationText` / `clientNote` are typed `Record<string, never>`
  // (nullable string without `type`), and optional fields with a default (`cancelledBy`, `force`, `email`,
  // `resolveReports`) are marked required. Checked without those keys.
  Expect<
    Assignable<
      Omit<CreateBookingBody, "locationText" | "clientNote">,
      Omit<S["CreateBookingDto"], "locationText" | "clientNote">
    >
  >,
  Expect<
    Assignable<
      ChangeStatusBody,
      Omit<S["ChangeStatusDto"], "cancelledBy"> & { cancelledBy?: S["ChangeStatusDto"]["cancelledBy"] }
    >
  >,
  Expect<Assignable<RescheduleBody, Omit<S["RescheduleBookingDto"], "force"> & { force?: boolean }>>,
  Expect<Assignable<ChangePriceBody, S["ChangePriceDto"]>>,
  Expect<Assignable<UpdateBookingBody, S["UpdateBookingDto"]>>,
  // module 11 — messages
  Expect<Assignable<S["ConversationRowDto"], ConversationRow>>,
  Expect<Assignable<S["ConversationCountsDto"], ConversationCounts>>,
  Expect<Assignable<S["ConversationDetailDto"], ConversationDetail>>,
  Expect<Assignable<S["AdminMessageDto"], AdminMessage>>,
  Expect<Assignable<S["MessagesPageDto"], MessagesPage>>,
  Expect<Assignable<S["ReadResultDto"], ReadResult>>,
  Expect<Assignable<CreateConversationBody, Omit<S["CreateConversationDto"], "email"> & { email?: boolean }>>,
  Expect<
    Assignable<
      CloseConversationBody,
      Omit<S["CloseConversationDto"], "resolveReports"> & { resolveReports?: boolean }
    >
  >,
  // module 9 — disputes
  Expect<Assignable<S["DisputeRowDto"], DisputeRow>>,
  Expect<Assignable<S["DisputeTabCountsDto"], DisputeTabCounts>>,
  Expect<Assignable<S["DisputeDetailDto"], DisputeDetail>>,
  Expect<Assignable<OpenDisputeBody, S["OpenDisputeDto"]>>,
  Expect<Assignable<ResolveDisputeBody, S["ResolveDisputeDto"]>>,
  Expect<Assignable<CloseDisputeBody, S["CloseDisputeDto"]>>,
  Expect<Assignable<RequestEvidenceBody, S["RequestEvidenceDto"]>>,
  // module 10 — forms, public form, academic requests
  Expect<Assignable<S["FormRowDto"], FormRow>>,
  Expect<Assignable<S["FormTabCountsDto"], FormTabCounts>>,
  Expect<Assignable<S["FormDetailDto"], FormDetail>>,
  Expect<Assignable<S["FormVersionDto"], FormVersion>>,
  Expect<Assignable<CreateFormBody, S["CreateFormDto"]>>,
  Expect<Assignable<UpdateFormBody, S["UpdateFormDto"]>>,
  Expect<Assignable<SaveDraftBody, S["SaveDraftDto"]>>,
  Expect<Assignable<S["PublicFormDto"], PublicForm>>,
  Expect<Assignable<S["EmailCodeResultDto"], EmailCodeResult>>,
  Expect<Assignable<S["UploadResultDto"], UploadResult>>,
  Expect<Assignable<S["PublicCategoryDto"], PublicCategory>>,
  Expect<Assignable<S["PublicWilayaDto"], PublicWilaya>>,
  Expect<Assignable<SubmitFormBody, S["SubmitFormDto"]>>,
  Expect<Assignable<S["SubmissionResultDto"], SubmissionResult>>,
  Expect<Assignable<S["EditableRequestDto"], EditableRequest>>,
  Expect<Assignable<EditAnswersBody, S["EditAnswersDto"]>>,
  Expect<Assignable<S["AcademicRequestRowDto"], RequestRow>>,
  Expect<Assignable<S["AcademicRequestTabCountsDto"], RequestTabCounts>>,
  // `allowedActions` is typed `string[]` in openapi.json (no enum) — checked without it.
  Expect<
    Assignable<Omit<S["AcademicRequestDetailDto"], "allowedActions">, Omit<RequestDetail, "allowedActions">>
  >,
  Expect<Assignable<RequestChangesBody, S["RequestChangesDto"]>>,
  Expect<Assignable<ApproveRequestBody, S["ApproveRequestDto"]>>,
  Expect<Assignable<RejectRequestBody, S["RejectRequestDto"]>>,
  Expect<Assignable<CancelRequestBody, S["CancelRequestDto"]>>,
  Expect<Assignable<CreateProposalBody, S["CreateProposalDto"]>>,
  Expect<Assignable<BookProposalBody, S["BookProposalDto"]>>,
  // module 12 — reviews, replies, reports
  Expect<Assignable<S["ReviewRowDto"], ReviewRow>>,
  Expect<Assignable<S["ReviewTabCountsDto"], ReviewTabCounts>>,
  Expect<Assignable<S["ReviewDetailDto"], ReviewDetail>>,
  // `notifyAuthor` has a default, so openapi-typescript marks it required; the API treats it as optional.
  Expect<
    Assignable<ModerateReviewBody, Omit<S["ModerateReviewDto"], "notifyAuthor"> & { notifyAuthor?: boolean }>
  >,
  Expect<Assignable<EditReviewBody, S["EditReviewDto"]>>,
  Expect<Assignable<DeleteReviewBody, S["DeleteReviewDto"]>>,
  Expect<Assignable<S["ReviewDeletedDto"], ReviewDeleted>>,
  Expect<Assignable<S["ReplyDeletedDto"], ReplyDeleted>>,
  Expect<Assignable<S["ReportRowDto"], ReportRow>>,
  Expect<Assignable<S["ReportTabCountsDto"], ReportTabCounts>>,
  Expect<Assignable<ResolveReportBody, S["ResolveReportDto"]>>,
  Expect<Assignable<DismissReportBody, S["DismissReportDto"]>>,
  Expect<Assignable<ConvertReportBody, S["ConvertReportDto"]>>,
  Expect<Assignable<S["MessageReportsDismissedDto"], MessageReportsDismissed>>,
  // module 13 — overview, search, notifications, sidebar counts
  // Two backend classes are named `BookingsByStatusDto` (services stats and overview): the schema keeps the services one,
  // so `bookingsByStatus` is checked against the overview DTO source (`{ status, count, percent }[]`) — reported upstream.
  Expect<Assignable<Omit<S["OverviewDto"], "bookingsByStatus">, Omit<Overview, "bookingsByStatus">>>,
  Expect<Assignable<S["NavCountsDto"], NavCounts>>,
  Expect<Assignable<S["SearchResultDto"], SearchResult>>,
  Expect<Assignable<S["AdminNotificationDto"], AdminNotification>>,
  Expect<Assignable<S["UnreadCountDto"], UnreadCount>>,
  Expect<Assignable<S["MarkReadResultDto"], MarkReadResult>>,
];
