import type { PendingKickRecord } from "./services/kick-queue-service";
import type { KickQueuedUsersResult } from "./processor";

export interface CheckAllResponseResult {
  addedCount: number;
  alreadyPendingCount: number;
  excludedCount: number;
  failedCount: number;
}

export type CheckResponseOutcome = "added" | "already-pending" | "enqueue-failed";

function formatPendingKickList(userIds: string[]): string {
  return userIds.map((userId, index) => `${index + 1}. <@${userId}>`).join(", ");
}

export default class MembersResponse {
  buildCheckResponse(userId: string, outcome: CheckResponseOutcome): string {
    if (outcome === "already-pending") {
      return `Пользователь <@${userId}> уже находится в очереди на кик, сообщение повторно не поставлено в очередь отправки`;
    }

    if (outcome === "enqueue-failed") {
      return `Пользователь <@${userId}> не добавлен в очередь на кик, сообщение не удалось поставить в очередь отправки`;
    }

    return `Пользователь <@${userId}> добавлен в очередь на кик, сообщение поставлено в очередь отправки`;
  }

  buildCheckAllResponse(result: CheckAllResponseResult): string {
    return `В очередь на кик добавлено ${result.addedCount} пользователей, уже в очереди ${result.alreadyPendingCount} пользователей, исключено ${result.excludedCount} пользователей, не удалось поставить в очередь отправки для ${result.failedCount} пользователей, сообщения поставлены в очередь отправки только для новых пользователей`;
  }

  buildAddResponse(userId: string, wasAdded: boolean): string {
    return wasAdded
      ? `Пользователь <@${userId}> добавлен в очередь на кик`
      : `Пользователь <@${userId}> уже находится в очереди на кик`;
  }

  buildRemoveResponse(userId: string, removed: boolean): string {
    return removed
      ? `Пользователь <@${userId}> удалён из очереди на кик`
      : `Пользователь <@${userId}> не найден в очереди на кик`;
  }

  buildListResponse(records: PendingKickRecord[]): string {
    if (records.length === 0) {
      return "Очередь пользователей на кик пуста";
    }

    return formatPendingKickList(records.map((record) => record.discordUserId));
  }

  buildKickResponse(result: KickQueuedUsersResult): string {
    return `Кикнуто ${result.kickedCount} пользователей, не найдено на сервере ${result.notFoundCount} пользователей, не удалось кикнуть ${result.failedCount} пользователей, в очереди оставлено ${result.notFoundCount + result.failedCount} пользователей`;
  }

  buildUnknownSubcommandResponse(): string {
    return "Неизвестная подкоманда kickqueue";
  }
}
