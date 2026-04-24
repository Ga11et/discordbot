import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";
import { birthdayCommandDefinition } from "../src/commands/birthday-definition";

describe("birthdayCommandDefinition", () => {
  it("defines the delete subcommand with required user option", () => {
    const deleteOption = birthdayCommandDefinition.options?.find(
      (option) =>
        option.type === ApplicationCommandOptionType.Subcommand &&
        option.name === "delete",
    );

    expect(deleteOption).toBeDefined();
    expect(deleteOption?.description).toBe(
      "Удалить сохранённую дату рождения пользователя",
    );
    expect(deleteOption?.options).toEqual([
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "У кого удалить дату рождения",
        required: true,
      },
    ]);
  });

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
