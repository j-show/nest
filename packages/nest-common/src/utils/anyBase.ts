class Converter {
  private srcAlphabet: string;
  private dstAlphabet: string;

  constructor(src: string, dest: string) {
    if (!src.length || !dest.length) throw new Error('Bad alphabet');

    this.srcAlphabet = src;
    this.dstAlphabet = dest;
  }

  public isValid(chars: string) {
    for (let i = 0; i < chars.length; ++i) {
      if (this.srcAlphabet.indexOf(chars[i]) === -1) return false;
    }

    return true;
  }

  public convert(number: string) {
    const numberMap: Record<string, number> = {};
    const fromBase = this.srcAlphabet.length;
    const toBase = this.dstAlphabet.length;

    if (!this.isValid(number)) {
      throw new Error('Number "' + number + '" contains of non-alphabetic digits (' + this.srcAlphabet + ')');
    }

    if (this.srcAlphabet === this.dstAlphabet) {
      return number;
    }

    let length = number.length;
    let result = '';
    for (let i = 0; i < length; i++) numberMap[i.toString()] = this.srcAlphabet.indexOf(number[i]);

    let newlen = 0;
    do {
      let divide = 0;

      for (let i = 0; i < length; i++) {
        divide = divide * fromBase + (numberMap[i.toString()] ?? 0);

        if (divide >= toBase) {
          numberMap[newlen.toString()] = Math.floor(divide / toBase);
          newlen++;
          divide = divide % toBase;
        } else if (newlen > 0) {
          numberMap[newlen.toString()] = 0;
          newlen++;
        }
      }

      length = newlen;
      result = this.dstAlphabet.slice(divide, divide + 1).concat(result);
    } while (newlen !== 0);

    return result;
  }
}

export const ANY_BASE = {
  BIN: '01',
  OCT: '01234567',
  DEC: '0123456789',
  HEX: '0123456789abcdef',
} as const;

export const anyBase = (type: keyof typeof ANY_BASE, dstAlphabet: string) => {
  const converter = new Converter(ANY_BASE[type], dstAlphabet);

  return (chars: string) => converter.convert(chars);
};
