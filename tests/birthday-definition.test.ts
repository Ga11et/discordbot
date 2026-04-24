import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";
import { birthdayCommandDefinition } from "../src/commands/birthday-definition";

describe("birthdayCommandDefinition", () => {
  it("defines optional messageid for the gratz subcommand", () => {
    const gratzOption = birthdayCommandDefinition.options?.find(
      (option) =>
        option.type === ApplicationCommandOptionType.Subcommand &&
        option.name === "gratz",
    );

    expect(gratzOption).toBeDefined();
    expect(gratzOption?.options).toEqual([
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "Кого поздравить",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "messageid",
        description: "Идентификатор поздравления",
        required: false,
      },
    ]);
  });
});
