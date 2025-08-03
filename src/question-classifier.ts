import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import "dotenv/config";

// Zod schema equivalent to Pydantic BaseModel
export const GradeQuestionSchema = z.object({
  score: z
    .string()
    .describe("Question is about restaurant? If yes -> 'Yes' if not -> 'No'"),
});

export type GradeQuestion = z.infer<typeof GradeQuestionSchema>;

type AgentState = typeof MessagesAnnotation.State;

export function questionClassifier(state: AgentState): Promise<GradeQuestion> {
  const question = state.messages[state.messages.length - 1].content;

  const system = `You are a classifier that determines whether a user's question is about one of the following topics:

1. Information about the owner of Bella Vista, which is Antonio Rossi.
2. Prices of dishes at Bella Vista (restaurant).
3. Opening hours of Bella Vista (restaurant).

If the question IS about any of these topics, respond with 'Yes'. Otherwise, respond with 'No'. Remember, ONLY YES or NO, nothing else in the response!`;

  const gradePrompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", "User question: {question}"],
  ]);

  const model = new ChatOpenAI({ temperature: 0 });

  // Create structured output using withStructuredOutput
  const structuredLLM = model.withStructuredOutput(GradeQuestionSchema);

  const chain = gradePrompt.pipe(structuredLLM);

  return chain.invoke({ question });
}

// Example usage function
export async function testQuestionClassifier() {
  // Test cases
  const testQuestions = [
    "What are the opening hours of Bella Vista?",
    "Who owns Bella Vista restaurant?",
    "How much do appetizers cost at Bella Vista?",
    "What's the weather like today?",
    "Tell me about machine learning",
  ];

  console.log("Testing Question Classifier:");
  console.log("=" * 50);

  for (const question of testQuestions) {
    // Create a mock state with the question
    const mockState: AgentState = {
      messages: [
        { content: question, additional_kwargs: {}, response_metadata: {} },
      ],
    };

    try {
      const result = await questionClassifier(mockState);
      console.log(`Question: "${question}"`);
      console.log(`Classification: ${result.score}`);
      console.log("-".repeat(30));
    } catch (error) {
      console.error(`Error classifying question: "${question}"`, error);
    }
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testQuestionClassifier().catch(console.error);
}
