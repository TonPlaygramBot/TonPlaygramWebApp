export class TouchChannels {
  owners: Map<string, number>;
  begin(channel: string, id: number): boolean;
  owns(channel: string, id: number): boolean;
  end(channel: string, id: number): boolean;
  clear(): void;
}
export function thumbStick(
  dx: number,
  dy: number,
  radius: number,
  driving?: boolean,
  wasRunning?: boolean
): {
  x: number;
  y: number;
  knobX: number;
  knobY: number;
  sprint: boolean;
};
