import { type AIMessage, HumanMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";
import { renderGraph } from "./utils/render-graph";

import "dotenv/config"; // loads .env at startup

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

export function shouldContinue(state: MessagesState): "tools" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage?.tool_calls?.length && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}

const tools = [getWeather];
const model = new ChatOpenAI({ temperature: 0 }).bindTools(tools);

// getWeather
//   .invoke({
//     location: "Munich",
//   })
//   .then((result) => {
//     console.log(result); // "It's 15 degrees Celsius and cloudy."
//   });

type MessagesState = typeof MessagesAnnotation.State;

export async function callModel(
  state: MessagesState
): Promise<Partial<MessagesState>> {
  const messages = state.messages;
  const response = await model.invoke(messages);
  return { messages: [response] }; // triggers reducer to append
}

const toolNode = new ToolNode([getWeather]);
const workflow = new StateGraph(MessagesAnnotation);

workflow
  .addNode("tools", toolNode)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();

const graph = workflow.compile({ checkpointer });

async function main() {
  //   renderGraph(graph);

  const messages1 = [new HumanMessage("Hello, how are you?")];
  const messages2 = [new HumanMessage("How is the weather in munich?")];
  const messages3 = [
    new HumanMessage("What would you recommend to do in that city than?"),
  ];

  console.dir(
    await graph.invoke(
      { messages: messages1 },
      { configurable: { thread_id: 1 } }
    ),
    { depth: 2 }
  );
  console.dir(
    await graph.invoke(
      { messages: messages2 },
      { configurable: { thread_id: 1 } }
    ),
    { depth: 2 }
  );
  console.dir(
    await graph.invoke(
      { messages: messages3 },
      { configurable: { thread_id: 1 } }
    ),
    { depth: 2 }
  );
}

main().catch(console.error);
