export default class ArrayHelper {
  static last<T>(arr: T[]): T | undefined {
    return arr.length > 0 ? arr[arr.length - 1] : undefined;
  }
}
