import { writeFile } from "node:fs/promises";
import type { CompiledStateGraph } from "@langchain/langgraph";

export async function renderGraph(runnable: CompiledStateGraph<any, any>) {
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
