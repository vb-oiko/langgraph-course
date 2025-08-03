import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import type { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";
import { z } from "zod";
import {
  BELLA_VISTA_COLUMNS,
  BELLA_VISTA_DOCS_TABLE,
  poolConfig,
  seedBellaVistaDocEmbeddings,
} from "./utils/bella-vista";

import "dotenv/config"; // loads .env at startup
import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { renderGraph } from "./utils/render-graph";

const embeddingFunction = new OpenAIEmbeddings();

// RAG prompt template (equivalent to hub.pull("rlm/rag-prompt"))
const ragPrompt =
  ChatPromptTemplate.fromTemplate(`You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.

Question: {question}

Context: {context}

Answer:`);

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>(),
  documents: Annotation<Document[]>(),
  onTopic: Annotation<string>(),
});

type AgentState = typeof AgentState.State;

const pool = new Pool(poolConfig);

const vectorStore = new PGVectorStore(embeddingFunction, {
  pool,
  tableName: BELLA_VISTA_DOCS_TABLE,
  columns: BELLA_VISTA_COLUMNS,
});

const retriever = vectorStore.asRetriever({ k: 2 });

const llm = new ChatOpenAI();
const ragChain = ragPrompt.pipe(llm);

export const GradeQuestionSchema = z.object({
  score: z
    .string()
    .describe("Question is about restaurant? If yes -> 'Yes' if not -> 'No'"),
});

export type GradeQuestion = z.infer<typeof GradeQuestionSchema>;

async function questionClassifier(state: AgentState): Promise<AgentState> {
  const question = state.messages[state.messages.length - 1].content;

  const system = `You are a classifier that determines whether a user's question is about one of the following topics:

    1. Information about the owner of Bella Vista, which is Antonio Rossi.
    2. Prices of dishes at Bella Vista (restaurant).
    3. Opening hours of Bella Vista (restaurant).

    If the question IS about any of these topics, respond with 'Yes'. Otherwise, respond with 'No'. Remember, ONLY YES or NO, nothing else in the response!
  `;

  const gradePrompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", "User question: {question}"],
  ]);

  const model = new ChatOpenAI({ temperature: 0 });

  // Create structured output using withStructuredOutput
  const graderLLM = model.withStructuredOutput(GradeQuestionSchema);

  const chain = gradePrompt.pipe(graderLLM);

  const { score } = await chain.invoke({ question });

  console.dir({ question, score });
  state.onTopic = score.toLowerCase();
  return state;
}

async function onTopicRouter(state: AgentState) {
  if (state.onTopic === "yes") {
    return "on_topic";
  }
  return "off_topic";
}

async function retrieve(state: AgentState): Promise<AgentState> {
  const lastMessage = state.messages.at(-1);
  if (!lastMessage) {
    console.error(
      "Messages list is empty. Cannot retrieve documents for the question"
    );
    return state;
  }
  const question = lastMessage.content as string;
  const documents = await retriever.invoke(question);
  console.dir({ node: "retrieve documents", question, documents });
  state.documents = documents;
  return state;
}

async function generateAnswer(state: AgentState): Promise<AgentState> {
  const lastMessage = state.messages.at(-1);
  if (!lastMessage) {
    console.error(
      "Messages list is empty. Cannot retrieve documents for the question"
    );
    return state;
  }
  const question = lastMessage.content as string;
  const documents = state.documents;
  const answer = await ragChain.invoke({ context: documents, question });
  state.messages.push(answer);
  return state;
}

async function offTopicResponse(state: AgentState): Promise<AgentState> {
  state.messages.push(new AIMessage("I cant respond to that!"));
  return state;
}

const graph = new StateGraph(AgentState)
  .addNode("topic_decision", questionClassifier)
  .addNode("off_topic_response", offTopicResponse)
  .addNode("retrieve", retrieve)
  .addNode("generate_answer", generateAnswer)
  .addEdge(START, "topic_decision")
  .addConditionalEdges("topic_decision", onTopicRouter, {
    on_topic: "retrieve",
    off_topic: "off_topic_response",
  })
  .addEdge("retrieve", "generate_answer")
  .addEdge("generate_answer", END)
  .addEdge("off_topic_response", END)
  .compile();

async function main() {
  // await renderGraph(graph, "RAG-agent");

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
