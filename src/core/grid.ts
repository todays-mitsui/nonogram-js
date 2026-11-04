/**
 * マスを長方形に並べた構造(GLOSSARY §2 グリッド)。
 * 不変。変更系のメソッドは新しい Grid を返す。
 */

export type Axis = 'row' | 'column'

/** 行または列。`index` は行なら y、列なら x。 */
export interface Line {
  readonly axis: Axis
  readonly index: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface CellUpdate<T> extends Point {
  readonly value: T
}

export class Grid<T> {
  readonly width: number
  readonly height: number
  readonly #cells: readonly T[]

  private constructor(width: number, height: number, cells: readonly T[]) {
    this.width = width
    this.height = height
    this.#cells = cells
  }

  /** 全マスを `value` で埋めたグリッド。 */
  static filled<T>(width: number, height: number, value: T): Grid<T> {
    assertSize(width, height)
    return new Grid(
      width,
      height,
      Array.from({ length: width * height }, () => value),
    )
  }

  /** 行優先(y を外側、x を内側)に並べたマスからグリッドを作る。 */
  static fromCells<T>(width: number, height: number, cells: readonly T[]): Grid<T> {
    assertSize(width, height)
    if (cells.length !== width * height) {
      throw new RangeError(`cells.length must be ${width * height}, got ${cells.length}`)
    }
    return new Grid(width, height, [...cells])
  }

  /** 行の配列(上から順)からグリッドを作る。すべての行は同じ長さでなければならない。 */
  static fromRows<T>(rows: readonly (readonly T[])[]): Grid<T> {
    const height = rows.length
    const width = rows[0]?.length ?? 0
    if (rows.some((row) => row.length !== width)) {
      throw new RangeError('all rows must have the same length')
    }
    return Grid.fromCells(width, height, rows.flat())
  }

  get size(): Size {
    return { width: this.width, height: this.height }
  }

  contains(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height
    )
  }

  get(x: number, y: number): T {
    return this.#cells[this.#index(x, y)] as T
  }

  set(x: number, y: number, value: T): Grid<T> {
    return this.setMany([{ x, y, value }])
  }

  /** 複数のマスをまとめて書き換える。同じマスが複数回あれば後のものが勝つ。 */
  setMany(updates: Iterable<CellUpdate<T>>): Grid<T> {
    const cells = [...this.#cells]
    let changed = false
    for (const { x, y, value } of updates) {
      const i = this.#index(x, y)
      if (!Object.is(cells[i], value)) {
        cells[i] = value
        changed = true
      }
    }
    return changed ? new Grid(this.width, this.height, cells) : this
  }

  /** 1ライン分のマス。行は左→右、列は上→下。 */
  line(line: Line): T[] {
    if (line.axis === 'row') {
      this.#index(0, line.index)
      const start = line.index * this.width
      return this.#cells.slice(start, start + this.width)
    }
    this.#index(line.index, 0)
    return Array.from({ length: this.height }, (_, y) => this.get(line.index, y))
  }

  rows(): T[][] {
    return Array.from({ length: this.height }, (_, y) => this.line({ axis: 'row', index: y }))
  }

  columns(): T[][] {
    return Array.from({ length: this.width }, (_, x) => this.line({ axis: 'column', index: x }))
  }

  /**
   * サイズを変える。左上 (0, 0) を固定し、広げた部分は `fill` で埋め、はみ出した部分は捨てる。
   */
  resize(width: number, height: number, fill: T): Grid<T> {
    assertSize(width, height)
    if (width === this.width && height === this.height) return this
    const cells: T[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells.push(x < this.width && y < this.height ? this.get(x, y) : fill)
      }
    }
    return new Grid(width, height, cells)
  }

  map<U>(fn: (value: T, x: number, y: number) => U): Grid<U> {
    return new Grid(
      this.width,
      this.height,
      this.#cells.map((value, i) => fn(value, i % this.width, Math.floor(i / this.width))),
    )
  }

  /** 行優先に並べたマスのコピー。 */
  toCells(): T[] {
    return [...this.#cells]
  }

  equals(other: Grid<T>, eq: (a: T, b: T) => boolean = Object.is): boolean {
    return (
      this.width === other.width &&
      this.height === other.height &&
      this.#cells.every((value, i) => eq(value, other.#cells[i] as T))
    )
  }

  #index(x: number, y: number): number {
    if (!this.contains(x, y)) {
      throw new RangeError(`(${x}, ${y}) is outside the ${this.width}x${this.height} grid`)
    }
    return y * this.width + x
  }
}

function assertSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
    throw new RangeError(`invalid grid size ${width}x${height}`)
  }
}
