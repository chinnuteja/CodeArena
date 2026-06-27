import { z } from 'zod';

const schema = z.object({
  isPractice: z.string().optional().transform(val => val ? val === 'true' : undefined),
});

const parsed = schema.parse({});
console.log('Parsed isPractice:', parsed.isPractice);
console.log('Is it strictly undefined?', parsed.isPractice === undefined);
console.log('Is it in the object?', 'isPractice' in parsed);

const filter: any = {};
if (parsed.isPractice !== undefined) {
  filter.isPractice = parsed.isPractice;
}
console.log('Filter:', filter);
