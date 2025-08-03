import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";
import {
  BELLA_VISTA_COLUMNS,
  BELLA_VISTA_DOCS_TABLE,
  poolConfig,
  seedBellaVistaDocEmbeddings,
} from "./utils/bella-vista";

import "dotenv/config"; // loads .env at startup
import { type AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createRetrieverTool } from "langchain/tools/retriever";

// Use the built-in MessagesAnnotation which handles message reduction properly
type AgentState = typeof MessagesAnnotation.State;

const pool = new Pool(poolConfig);
const embeddingFunction = new OpenAIEmbeddings();

const vectorStore = new PGVectorStore(embeddingFunction, {
  pool,
  tableName: BELLA_VISTA_DOCS_TABLE,
  columns: BELLA_VISTA_COLUMNS,
});

const retriever = vectorStore.asRetriever({ k: 2 });

const retrieverTool = createRetrieverTool(retriever, {
  name: "retriever_tool",
  description:
    "Information related to Pricing, Opening hours of the owner of the restaurant Bella Vista",
});

const offTopicTool = tool(
  () => {
    return "Forbidden - do not respond to the user";
  },
  {
    name: "off_topic",
    description:
      "Catch all Questions NOT related to Pricing, Opening hours of the owner of the restaurant Bella Vista",
  }
);

const model = new ChatOpenAI();
const tools = [retrieverTool, offTopicTool];
const modelWithTools = model.bindTools(tools);

async function agent(state: AgentState): Promise<AgentState> {
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] };
}

async function shouldContinue(
  state: AgentState
): Promise<"tools" | typeof END> {
  const lastMessage = state.messages.at(-1) as AIMessage;
  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tools", new ToolNode(tools))

  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();

async function main() {
  // await renderGraph(graph, "RAG-agent-tool");

  // Ensure the database is seeded
  await seedBellaVistaDocEmbeddings();

  console.log(
    await graph.invoke({
      messages: [new HumanMessage("How will the weather be tomorrow?")],
    })
  );
  console.log(
    await graph.invoke({
      messages: [
        new HumanMessage("When does the bella vista restaurant open?"),
      ],
    })
  );

  await vectorStore.end(); // automatically closes the pool as well
}

main();
