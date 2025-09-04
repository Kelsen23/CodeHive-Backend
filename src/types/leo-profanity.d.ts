declare module "leo-profanity" {
  const leoProfanity: {
    add(words: string[]): void;
    clean(text: string): string;
    list(): string[];
    remove(words: string[]): void;
    check(text: string): boolean;
  };
  export = leoProfanity;
}
