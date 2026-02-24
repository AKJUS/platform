import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const dashboardCatalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({
        title: z.string().optional().describe('The title of the card'),
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
    Stack: {
      props: z.object({
        direction: z
          .enum(['vertical', 'horizontal'])
          .optional()
          .describe('Layout direction, defaults to vertical'),
        gap: z.number().optional().describe('Gap between children in pixels'),
        align: z
          .enum(['start', 'center', 'end', 'stretch'])
          .optional()
          .describe('Alignment of children'),
        justify: z
          .enum(['start', 'center', 'end', 'between', 'around'])
          .optional()
          .describe('Justification of children'),
      }),
      hasChildren: true,
      description: 'A flexible flexbox container for layout.',
    },
    Grid: {
      props: z.object({
        cols: z
          .number()
          .optional()
          .describe('Number of columns, defaults to 1'),
        gap: z.number().optional().describe('Gap between children in pixels'),
      }),
      hasChildren: true,
      description: 'A grid container for multi-column layouts.',
    },
    Text: {
      props: z.object({
        content: z.string().describe('The text content'),
        variant: z
          .enum(['h1', 'h2', 'h3', 'h4', 'p', 'small', 'tiny'])
          .optional()
          .describe('Typography variant'),
        weight: z
          .enum(['normal', 'medium', 'semibold', 'bold'])
          .optional()
          .describe('Font weight'),
        color: z
          .enum(['default', 'muted', 'primary', 'success', 'warning', 'error'])
          .optional()
          .describe('Text color'),
        align: z
          .enum(['left', 'center', 'right'])
          .optional()
          .describe('Text alignment'),
      }),
      hasChildren: false,
      description: 'A typography component for rendering text.',
    },
    Icon: {
      props: z.object({
        name: z.string().describe('Name of the icon (e.g. "User", "Check")'),
        size: z.number().optional().describe('Size in pixels, defaults to 16'),
        color: z.string().optional().describe('Icon color (CSS color or hex)'),
      }),
      hasChildren: false,
      description: 'Display an icon from the platform icon set.',
    },
    Badge: {
      props: z.object({
        label: z.string().describe('The label shown in the badge'),
        variant: z
          .enum([
            'default',
            'secondary',
            'outline',
            'success',
            'warning',
            'error',
          ])
          .optional()
          .describe('Badge visual style'),
      }),
      hasChildren: false,
      description: 'A small status indicator badge.',
    },
    Avatar: {
      props: z.object({
        src: z.string().optional().describe('URL of the image'),
        fallback: z.string().optional().describe('Fallback initials'),
        size: z.number().optional().describe('Size in pixels, defaults to 32'),
      }),
      hasChildren: false,
      description: 'A circular profile image component.',
    },
    Separator: {
      props: z.object({
        orientation: z
          .enum(['horizontal', 'vertical'])
          .optional()
          .describe('Orientation, defaults to horizontal'),
      }),
      hasChildren: false,
      description: 'A visual line to separate content.',
    },
    Progress: {
      props: z.object({
        value: z.number().describe('Progress value from 0 to 100'),
        label: z.string().optional().describe('Optional label'),
        showValue: z
          .boolean()
          .optional()
          .describe('Whether to show the percentage'),
      }),
      hasChildren: false,
      description: 'A progress bar component.',
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
      hasChildren: false,
      description: 'A component used to display a single, prominent metric.',
    },
    MyTasks: {
      props: z.object({
        showSummary: z
          .boolean()
          .optional()
          .describe('Whether to show the task summary cards'),
        showFilters: z
          .boolean()
          .optional()
          .describe('Whether to show the task filter bar'),
      }),
      hasChildren: false,
      description: "A component that renders the user's current task list.",
    },
    TimeTrackingStats: {
      props: z.object({
        period: z
          .enum([
            'today',
            'this_week',
            'this_month',
            'last_7_days',
            'last_30_days',
            'custom',
          ])
          .optional()
          .describe('Stats period preset. Defaults to last_7_days.'),
        dateFrom: z
          .string()
          .optional()
          .describe(
            'Custom period start ISO datetime (required when period=custom).'
          ),
        dateTo: z
          .string()
          .optional()
          .describe(
            'Custom period end ISO datetime (required when period=custom).'
          ),
        showBreakdown: z
          .boolean()
          .optional()
          .describe('Show category breakdown list (default true).'),
        showDailyBreakdown: z
          .boolean()
          .optional()
          .describe('Show daily breakdown list (default true).'),
        maxItems: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Maximum rows for breakdown sections (default 5).'),
      }),
      hasChildren: false,
      description:
        'A standardized time-tracking stats dashboard that fetches and displays period metrics and breakdowns.',
    },
    Form: {
      props: z.object({
        title: z.string().describe('Form title to display'),
        description: z.string().optional().describe('Form description'),
        submitLabel: z
          .string()
          .optional()
          .describe('Text for the submit button, defaults to "Submit"'),
        submitAction: z
          .string()
          .optional()
          .describe(
            'The name of the action to trigger on submit (e.g. "submit_form")'
          ),
        onSubmit: z.any().optional().describe('Binding for the submit action'),
      }),
      hasChildren: true,
      description:
        'A form container for capturing user input. Should contain Input and other form elements, and trigger a submit action.',
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
          .enum(['text', 'number', 'email', 'password'])
          .optional()
          .describe('Input type, defaults to text'),
        value: z.any().optional().describe('Input value binding'),
      }),
      hasChildren: false,
      description: 'A text or number input field for a Form.',
    },
    FileAttachmentInput: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Field label shown to user'),
        description: z.string().optional().describe('Optional helper text'),
        required: z
          .boolean()
          .optional()
          .describe('Whether at least one file is required'),
        maxFiles: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('Maximum files allowed'),
        accept: z
          .string()
          .optional()
          .describe('Accepted mime types or extensions'),
        value: z.any().optional().describe('Attachment value binding'),
      }),
      hasChildren: false,
      description:
        'An attachment picker for forms that need evidence images or file uploads.',
    },
    Textarea: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Field label shown to user'),
        placeholder: z.string().optional().describe('Placeholder text'),
        required: z
          .boolean()
          .optional()
          .describe('Whether the field is required'),
        rows: z.number().optional().describe('Number of rows'),
        value: z.any().optional().describe('Textarea value binding'),
      }),
      hasChildren: false,
      description: 'A multi-line text input field for a Form.',
    },
    Checkbox: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Label shown next to checkbox'),
        description: z.string().optional().describe('Optional description'),
        required: z
          .boolean()
          .optional()
          .describe('Whether the field is required'),
        checked: z.any().optional().describe('Checkbox checked binding'),
      }),
      hasChildren: false,
      description: 'A single checkbox component.',
    },
    CheckboxGroup: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Group label'),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .describe('Options to choose from'),
        required: z
          .boolean()
          .optional()
          .describe('Whether at least one option is required'),
        values: z.any().optional().describe('Checkbox group values binding'),
      }),
      hasChildren: false,
      description: 'A group of checkboxes for multiple selection.',
    },
    RadioGroup: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Group label'),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .describe('Options to choose from'),
        required: z
          .boolean()
          .optional()
          .describe('Whether an option is required'),
        value: z.any().optional().describe('Radio group value binding'),
      }),
      hasChildren: false,
      description: 'A group of radio buttons for single selection.',
    },
    Select: {
      props: z.object({
        name: z.string().describe('Field name/ID'),
        label: z.string().describe('Select label'),
        placeholder: z.string().optional().describe('Placeholder text'),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .describe('Options to choose from'),
        required: z
          .boolean()
          .optional()
          .describe('Whether the field is required'),
        value: z.any().optional().describe('Select value binding'),
      }),
      hasChildren: false,
      description: 'A dropdown select component.',
    },
    Button: {
      props: z.object({
        label: z.string().describe('Button text'),
        variant: z
          .enum(['primary', 'secondary', 'destructive', 'outline', 'ghost'])
          .optional()
          .describe('Button visual style'),
      }),
      hasChildren: false,
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
      hasChildren: false,
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
      hasChildren: false,
      description: 'A collection of interactive flashcards with navigation.',
    },
    Quiz: {
      props: z.object({
        question: z.string().describe('The quiz question'),
        options: z
          .array(z.string())
          .min(1)
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
      hasChildren: false,
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
                .min(1)
                .describe('An array of string options'),
              answer: z.string().describe('The correct option'),
              explanation: z
                .string()
                .optional()
                .describe('Explanation shown after answering'),
            })
          )
          .min(1)
          .describe('Array of quiz questions'),
        randomize: z
          .boolean()
          .optional()
          .describe('Whether to randomize quiz order'),
      }),
      hasChildren: false,
      description:
        'An interactive multi-question quiz with navigation and scoring.',
    },
  },
  actions: {
    submit_form: {
      params: z.object({
        title: z.string().describe('The title of the form being submitted'),
        values: z
          .record(z.string(), z.any())
          .describe('The values of the form fields'),
      }),
      description: 'Submit a generic form back to the assistant.',
    },
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
    create_time_tracking_request: {
      params: z.object({
        wsId: z.string().describe('Workspace ID slug or UUID'),
        requestId: z
          .string()
          .uuid()
          .optional()
          .describe('Request UUID used for storage prefix'),
        title: z.string().describe('Request title'),
        description: z.string().optional().describe('Optional request details'),
        categoryId: z
          .string()
          .nullable()
          .optional()
          .describe('Category UUID or null'),
        taskId: z.string().nullable().optional().describe('Task UUID or null'),
        startTime: z.string().describe('Start time ISO 8601'),
        endTime: z.string().describe('End time ISO 8601'),
        imagePaths: z
          .array(z.string())
          .optional()
          .describe('Optional pre-uploaded storage paths'),
      }),
      description:
        'Submit a time tracking missed-entry request with optional evidence attachments.',
    },
  },
});
