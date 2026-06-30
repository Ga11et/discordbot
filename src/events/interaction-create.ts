import type { Interaction as DiscordInteraction } from "discord.js";
import birthdayAccess from "../commands/birthday/access";
import birthdayHandler from "../commands/birthday/handler";
import birthAccess from "../commands/birth/access";
import birthHandler from "../commands/birth/handler";
import type { CommandAccessConfig } from "../commands/shared/command-access";
import kickQueueAccess from "../commands/kick-queue/access";
import kickQueueCheck from "../commands/kick-queue/check";
import kickQueueHandler from "../commands/kick-queue/handler";

class Interaction {
  private readonly birthdayConfig: CommandAccessConfig;
  private readonly birthConfig: CommandAccessConfig;
  private readonly kickQueueConfig: CommandAccessConfig;

  constructor() {
    this.birthdayConfig = birthdayAccess.loadConfig();
    this.birthConfig = birthAccess.loadConfig();
    this.kickQueueConfig = kickQueueAccess.loadConfig();
  }

  private async handleModalInteraction(
    interaction: DiscordInteraction,
  ): Promise<boolean> {
    if (!interaction.isModalSubmit()) {
      return false;
    }

    if (interaction.customId.startsWith("bd:")) {
      const hasAccess = await birthdayAccess.ensureAccess(
        interaction,
        this.birthdayConfig,
      );
      if (!hasAccess) {
        return true;
      }
    }

    return birthdayHandler.handleModalSubmit(interaction);
  }

  private async handleButtonInteraction(
    interaction: DiscordInteraction,
  ): Promise<boolean> {
    if (!interaction.isButton()) {
      return false;
    }

    return kickQueueCheck.handleButtonInteraction(interaction);
  }

  private async handleChatInputInteraction(
    interaction: DiscordInteraction,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === "kickqueue") {
      const hasAccess = await kickQueueAccess.ensureAccess(
        interaction,
        this.kickQueueConfig,
      );
      if (!hasAccess) {
        return;
      }

      await kickQueueHandler.handleCommand(interaction);
      return;
    }

    if (interaction.commandName === "bd") {
      const hasAccess = await birthdayAccess.ensureAccess(
        interaction,
        this.birthdayConfig,
      );
      if (!hasAccess) {
        return;
      }

      await birthdayHandler.handleCommand(interaction);
      return;
    }

    if (interaction.commandName === "birth") {
      const hasAccess = await birthAccess.ensureAccess(
        interaction,
        this.birthConfig,
      );
      if (!hasAccess) {
        return;
      }

      await birthHandler.handleCommand(interaction);
    }
  }

  public handleInteraction = async (
    interaction: DiscordInteraction,
  ): Promise<void> => {
    const modalHandled = await this.handleModalInteraction(interaction);
    if (modalHandled) {
      return;
    }

    const buttonHandled = await this.handleButtonInteraction(interaction);
    if (buttonHandled) {
      return;
    }

    await this.handleChatInputInteraction(interaction);
  };
}

export default Interaction;
