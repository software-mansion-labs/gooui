import { d, std } from "typegpu";

export const checkerBoard = (uv: d.v2f): number => {
  "use gpu";
  const fuv = std.floor(uv);
  return std.abs(fuv.x + fuv.y) % 2;
};
