import React from "react";
import { GradientTracing } from "./gradient-tracing";

export const Demo: React.FC = () => (
  <GradientTracing
    width={200}
    height={200}
    path="M100,0 L75,75 L125,75 L50,200 L100,100 L50,100 L100,0"
    gradientColors={["#F1C40F", "#F1C40F", "#E67E22"]}
  />
);

export default Demo;
