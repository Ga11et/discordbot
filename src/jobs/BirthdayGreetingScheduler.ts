import type { Client } from "discord.js";
import type { Knex } from "knex";
import commandAccess from "../commands/shared/command-access";
import { BirthdayGratzLogService } from "../modules/birth/gratz-log/service";
import { BirthService } from "../modules/birth/base/service";
import GratzService from "../modules/birthdays/services/gratz-service";

const TARGET_CHANNEL_ID = "1494930795284922409";
const ONE_HOUR_MS = 60 * 60 * 1_000;

export class BirthdayGreetingScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly birthdayService: BirthService;
  private readonly gratzService: GratzService;
  private readonly gratzLogService: BirthdayGratzLogService;

  constructor(
    private readonly discord: Client,
    private readonly db: Knex,
  ) {
    this.birthdayService = new BirthService(db);
    this.gratzService = new GratzService(db);
    this.gratzLogService = new BirthdayGratzLogService(db);
  }

  start(): void {
    if (this.timer) {
      return;
    }

    void this.tick();
    this.timer = setInterval(() => void this.tick(), ONE_HOUR_MS);
    console.log("Birthday greeting scheduler started");
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    await this.tick();
  }

  private async tick(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      console.error("Ошибка в BirthdayGreetingScheduler", error);
    }
  }

  private async run(): Promise<void> {
    const candidateIds = await this.birthdayService.findTodayBirthdayUserIds();
    if (candidateIds.length === 0) {
      return;
    }

    const allowedChannelIds = commandAccess.parseIds(
      process.env.BD_ALLOWED_CHANNEL_ID,
    );
    if (!allowedChannelIds.includes(TARGET_CHANNEL_ID)) {
      console.warn(
        `Канал ${TARGET_CHANNEL_ID} не входит в список разрешённых (BD_ALLOWED_CHANNEL_ID), авто-поздравления пропущены`,
      );
      return;
    }

    const channel = await this.discord.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      console.warn(`Канал ${TARGET_CHANNEL_ID} недоступен или не текстовый`);
      return;
    }

    const guild = channel.guild;
    await guild.members.fetch();
    const memberIds = new Set(
      guild.members.cache
        .filter((member) => !member.user.bot)
        .map((member) => member.id),
    );

    const botId = this.discord.user?.id;
    if (!botId) {
      console.warn("Не удалось определить id бота для записи в лог");
      return;
    }

    for (const userId of candidateIds) {
      if (!memberIds.has(userId)) {
        continue;
      }

      const hasRecent = await this.gratzLogService.hasRecentGreeting(userId);
      if (hasRecent) {
        continue;
      }

      const messageTemplate = await this.gratzService.getRandomGratzMessage();
      if (!messageTemplate) {
        console.warn("Нет сохранённых поздравительных сообщений");
        continue;
      }

      const message = messageTemplate.text.replaceAll("[user]", `<@${userId}>`);
      try {
        await channel.send(message);
      } catch (error) {
        console.error(`Не удалось отправить поздравление для ${userId}`, error);
        continue;
      }

      try {
        await this.gratzLogService.createLog(guild.id, botId, userId);
      } catch (error) {
        console.error(`Не удалось записать лог поздравления для ${userId}`, error);
      }
    }
  }

}
