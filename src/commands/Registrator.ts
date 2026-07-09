import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import birthDef from "./birth/definition";
import jobsDef from "./jobs/definition";
import kqDef from "./kick-queue/definition";

type CommandDefinition = RESTPostAPIChatInputApplicationCommandsJSONBody;

interface CommandRegistrationConfig {
  token: string;
  clientId: string;
}

class CommandRegister {
  private readonly commandDefinitions: CommandDefinition[];

  constructor(definitions: CommandDefinition[] = []) {
    this.commandDefinitions = [...definitions];
  }

  public add(definition: CommandDefinition): this {
    this.commandDefinitions.push(definition);
    return this;
  }

  public addMany(definitions: CommandDefinition[]): this {
    this.commandDefinitions.push(...definitions);
    return this;
  }

  public definitions(): CommandDefinition[] {
    return [...this.commandDefinitions];
  }

  public async register(config: CommandRegistrationConfig): Promise<void> {
    const { token, clientId } = config;

    const rest = this.createRest(token);

    await rest.put(Routes.applicationCommands(clientId), {
      body: this.commandDefinitions,
    });
    console.log("Глобальные slash-команды обновлены");
  }

  private createRest(token: string): REST {
    return new REST({ version: "10" }).setToken(token);
  }
}

const commandRegister = new CommandRegister().addMany([birthDef, jobsDef, kqDef]);

export default commandRegister;
