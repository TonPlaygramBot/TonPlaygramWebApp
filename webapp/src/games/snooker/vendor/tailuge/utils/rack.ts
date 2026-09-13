import { Vector3 } from "three"
import { TableGeometry } from "../view/tablegeometry"

export class Rack {
  static get sixth() {
    return (TableGeometry.Y * 2) / 6
  }
  static get baulk() {
    return (-1.5 * TableGeometry.X * 2) / 5
  }

  static snookerColourPositions() {
    const dx = TableGeometry.X / 2
    const black = TableGeometry.X - (TableGeometry.X * 2) / 11
    const positions: Vector3[] = [
      new Vector3(Rack.baulk, -Rack.sixth, 0),
      new Vector3(Rack.baulk, Rack.sixth, 0),
      new Vector3(Rack.baulk, 0, 0),
      new Vector3(0, 0, 0),
      new Vector3(dx, 0, 0),
      new Vector3(black, 0, 0),
    ]
    return positions
  }

}
