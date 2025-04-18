export interface Lines {
  getLine(lineNumber: number): string | null;
}

export class TextLines implements Lines {
  private readonly lines: string[];

  public constructor(text: string) {
    this.lines = text.split(/\r\n|\n|\r/);
  }

  public getLine(lineNumber: number): string | null {
    if (lineNumber < 1 || lineNumber > this.lines.length) return null;
    return this.lines[lineNumber - 1];
  }

  public get size(): number {
    return this.lines.length;
  }
}
