import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const dashboardCatalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({
        title: z.string().describe('The title of the card'),
        description: z
          .string()
          .nullable()
          .optional()
          .describe('Optional description of the card'),
      }),
      hasChildren: true,
      description:
        'A structural container to group related components together. Always use this as a wrapper for other interactive elements.',
    },
    Metric: {
      props: z.object({
        title: z.string().describe('The name of the metric'),
        value: z.string().describe('The value to display'),
        trend: z
          .enum(['up', 'down', 'neutral'])
          .optional()
          .describe('The trend of the metric'),
        trendValue: z
          .string()
          .optional()
          .describe('The trend value to display, e.g. "+5%"'),
      }),
      description: 'A component used to display a single, prominent metric.',
    },
    Form: {
      props: z.object({
        title: z.string().describe('Form title to display'),
        description: z.string().optional().describe('Form description'),
      }),
      hasChildren: true,
      description:
        'A form container for capturing user input. Should contain Input and Button components, and trigger a submit action.',
    },
    Input: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Field label shown to user'),
        placeholder: z.string().optional().describe('Placeholder text'),
        required: z
          .boolean()
          .optional()
          .describe('Whether the field is required'),
        type: z
          .enum(['text', 'number', 'email'])
          .optional()
          .describe('Input type, defaults to text'),
      }),
      description: 'A text or number input field for a Form.',
    },
    Button: {
      props: z.object({
        label: z.string().describe('Button text'),
        variant: z
          .enum(['primary', 'secondary', 'destructive', 'outline'])
          .optional()
          .describe('Button visual style'),
      }),
      description:
        'A button to trigger an action within a Form or interactive component.',
    },
    Flashcard: {
      props: z.object({
        front: z.string().describe('Text for the front of the flashcard'),
        back: z.string().describe('Text for the back of the flashcard'),
        randomize: z
          .boolean()
          .optional()
          .describe('Whether to randomize side on start'),
      }),
      description: 'An interactive flashcard that flips when clicked.',
    },
    MultiFlashcard: {
      props: z.object({
        title: z.string().optional().describe('Title of the flashcard session'),
        description: z
          .string()
          .optional()
          .describe('Description or instructions'),
        flashcards: z
          .array(
            z.object({
              front: z.string().describe('Text for the front'),
              back: z.string().describe('Text for the back'),
            })
          )
          .describe('Array of flashcards'),
        randomize: z
          .boolean()
          .optional()
          .describe('Whether to randomize flashcard order'),
      }),
      description: 'A collection of interactive flashcards with navigation.',
    },
    Quiz: {
      props: z.object({
        question: z.string().describe('The quiz question'),
        options: z
          .array(z.string())
          .describe('An array of string options for the quiz'),
        answer: z
          .string()
          .describe(
            'The correct option (must exactly match one of the options)'
          ),
        explanation: z
          .string()
          .optional()
          .describe('Explanation shown after answering'),
        randomize: z
          .boolean()
          .optional()
          .describe('Whether to randomize option order'),
      }),
      description: 'An interactive multiple-choice quiz question.',
    },
    MultiQuiz: {
      props: z.object({
        title: z
          .string()
          .optional()
          .describe('Title of the multi-quiz session'),
        description: z
          .string()
          .optional()
          .describe('Description or instructions'),
        quizzes: z
          .array(
            z.object({
              question: z.string().describe('The quiz question'),
              options: z
                .array(z.string())
                .describe('An array of string options'),
              answer: z.string().describe('The correct option'),
              explanation: z
                .string()
                .optional()
                .describe('Explanation shown after answering'),
            })
          )
          .describe('Array of quiz questions'),
        randomize: z
          .boolean()
          .optional()
          .describe('Whether to randomize quiz order'),
      }),
      description:
        'An interactive multi-question quiz with navigation and scoring.',
    },
  },
  actions: {
    log_transaction: {
      params: z.object({
        amount: z
          .number()
          .describe('Amount (positive=income, negative=expense)'),
        description: z.string().nullable().describe('What was this for?'),
        walletId: z
          .string()
          .nullable()
          .describe('Wallet UUID. If null, uses the first wallet.'),
      }),
      description:
        'Log a financial transaction directly from a generated UI form.',
    },
  },
});
