// src/openai/weather.ts
import "dotenv/config"; // loads .env at startup
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const TOOL_NAMES = ["get_weather", "check_seating_availability"] as const;
type ToolName = (typeof TOOL_NAMES)[number];

// 1. Define tools as callable objects with zod schemas
const getWeather = new DynamicStructuredTool({
  name: "get_weather",
  description: "Call to get the current weather.",
  schema: z.object({
    location: z.string().describe("The city or place to get weather for"),
  }),
  func: async ({ location }) => {
    if (location.toLowerCase() === "munich") {
      return "It's 15 degrees Celsius and cloudy.";
    } else {
      return "It's 32 degrees Celsius and sunny.";
    }
  },
});

const checkSeatingAvailability = new DynamicStructuredTool({
  name: "check_seating_availability",
  description: "Call to check seating availability.",
  schema: z.object({
    location: z.string(),
    seating_type: z.string(), // could constrain further
  }),
  func: async ({ location, seating_type }) => {
    const l = location.toLowerCase();
    const s = seating_type.toLowerCase();

    if (l === "munich" && s === "outdoor") {
      return "Yes, we still have seats available outdoors.";
    } else if (l === "munich" && s === "indoor") {
      return "Yes, we have indoor seating available.";
    } else {
      return "Sorry, seating information for this location is unavailable.";
    }
  },
});

// const llm = new ChatOpenAI({
//   temperature: 0.7, // optional - default is 1
//   modelName: "gpt-3.5-turbo", // optional - default is also gpt-3.5-turbo
// });

// 2. Bind tools to LLM
const llm = new ChatOpenAI({ temperature: 0 });
const llmWithTools = llm.bindTools([getWeather, checkSeatingAvailability]);

const toolMapping: Record<ToolName, DynamicStructuredTool> = {
  get_weather: getWeather,
  check_seating_availability: checkSeatingAvailability,
};

const messages = [
  new HumanMessage(
    "How will the weather be in Munich today? Do you still have seats outdoor available?"
  ),
];

async function main() {
  //   const response = await llm.invoke("How will the weather be in Munich today?");
  const response = await llmWithTools.invoke(messages);
  console.log(response.tool_calls);

  if (!response.tool_calls || response.tool_calls.length === 0) {
    console.log("No tool calls made.");
    return;
  }

  messages.push(new AIMessage(response));

  for (const tool of response.tool_calls) {
    const toolName = tool.name as ToolName;

    if (!toolName || !(toolName in toolMapping)) {
      console.log(`Tool name is missing or not recognized: ${toolName}`);
      continue;
    }

    const toolArgs = tool.args;

    const result = await toolMapping[toolName].func(toolArgs);

    console.log(
      `Tool ${toolName} called with args ${JSON.stringify(
        toolArgs
      )} returned: ${result}`
    );
    messages.push(
      new ToolMessage({
        content: result,
        tool_call_id: tool.id!,
      })
    );
  }

  const finalOutput = await llmWithTools.invoke(messages);
  console.log(finalOutput.content);
}

main().catch(console.error);
