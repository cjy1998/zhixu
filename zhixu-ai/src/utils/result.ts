import type { Context } from "hono";

export class Result {
  constructor(
    public code: number,
    public data: any,
    public message: string,
  ) {
    this.code = code;
    this.data = data;
    this.message = message;
  }
  static success(c: Context, data: any = null, message: string = "success") {
    return c.json(new Result(0, data, message));
  }
  static error(c: Context, message: string, code: number = -1) {
    return c.json(new Result(code, null, message));
  }
}
