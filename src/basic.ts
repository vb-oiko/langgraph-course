// src/graph/zod-basic.ts
import "@langchain/langgraph/zod";
import { writeFile } from "node:fs/promises";
import { RunnableLambda } from "@langchain/core/runnables";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export const BRANCH_A = "branch_a";
export const BRANCH_B = "branch_b";

export const InputState = Annotation.Root({
	unchangedValue: Annotation<string>(),
	stringValue: Annotation<string>({
		reducer: (cur, upd) => `${cur}${upd}`,
		default: () => "",
	}),
	numericValue: Annotation<number>({
		reducer: (cur, upd) => cur + upd,
		default: () => 0,
	}),
	listValue: Annotation<string[]>({
		reducer: (cur, upd) => cur.concat(upd),
		default: () => [],
	}),
});

export type InputState = typeof InputState;

function modifyState(input: InputState) {
	console.dir({ state: input }, { depth: null, colors: true });
	return input;
}

export function router(state: InputState) {
	if (state.stringValue.length < 5) {
		return BRANCH_A;
	} else {
		return END;
	}
}

const graph = new StateGraph(InputState)
	.addNode(BRANCH_A, modifyState)
	.addNode(BRANCH_B, modifyState)
	.addEdge(START, BRANCH_A)
	.addEdge(BRANCH_A, BRANCH_B)
	// .addConditionalEdges(BRANCH_B, router, {
	// 	[BRANCH_A]: BRANCH_A,
	// 	[END]: END,
	// })
	.addEdge(BRANCH_B, END);

export const runnable = graph.compile();

// runnable.invoke({ stringValue: "a" });

export async function render() {
	const graph = runnable.getGraph();

	// PNG as a Blob
	const png = await graph.drawMermaidPng({
		withStyles: true,
		// backgroundColor: "white",
		// curveStyle: "linear",
		// nodeColors: { branch_a: "#eef" },
		// wrapLabelNWords: 3,
	});

	const arrayBuffer = await png.arrayBuffer();
	await writeFile("graph.png", Buffer.from(arrayBuffer));
	console.log("Saved graph.png");
}

render().catch(console.error);

const runnable1 = RunnableLambda.from<InputState, InputState>(modifyState);
export const chain = runnable1.pipe(runnable1);

async function main() {
	const result = await runnable.invoke({
		stringValue: "a",
		numericValue: 1,
		unchangedValue: "a",
		listValue: ["a"],
	});
	console.dir({ result }, { depth: null, colors: true });

	// const result1 = await chain.invoke({ stringValue: "a", numericValue: 42 });
	// console.dir({ result1 }, { depth: null, colors: true });
}

main();
