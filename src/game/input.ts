export type InputState = {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  firing: boolean;
  dash: boolean;
  keys: Set<string>;
};

export const input: InputState = {
  mx: 0,
  my: 0,
  ax: 0,
  ay: 0,
  firing: false,
  dash: false,
  keys: new Set(),
};

export function setKeys(codes: string[]) {
  input.keys = new Set(codes);
}

export function resetInput() {
  input.mx = 0;
  input.my = 0;
  input.ax = 0;
  input.ay = 0;
  input.firing = false;
  input.dash = false;
  input.keys.clear();
}
