import Poll, { PollComponentSchema, PollFormSchema } from "@models/Poll";
import { PollResponseAnswer, PollResponseAnswers } from "@models/PollResponse";

function flattenComponents(
  components: PollComponentSchema[]
): PollComponentSchema[] {
  return components.flatMap((component) => [
    component,
    ...flattenComponents(component.components || [])
  ]);
}

function getNiceAnswer(component: PollComponentSchema, value: string): string {
  return component.values?.find((v) => v.value === value)?.label || value;
}

function convertAnswer(
  component: PollComponentSchema,
  answer: PollResponseAnswer
): string {
  if (!answer) {
    return "";
  } else if (typeof answer === "object") {
    return Object.entries(answer)
      .filter(([value, selected]) => selected)
      .map(([value]) => getNiceAnswer(component, value))
      .join(", ");
  } else if (typeof answer === "string") {
    return getNiceAnswer(component, answer);
  } else {
    return answer.toString();
  }
}

export function convertAnswers(
  poll: Poll,
  answers: PollResponseAnswers
): Record<string, unknown> {
  if (poll.template !== "builder") {
    return answers;
  }

  const formSchema = poll.templateSchema.formSchema as PollFormSchema;

  return Object.assign(
    {},
    ...flattenComponents(formSchema.components)
      .filter((component) => component.input)
      .map((component) => {
        return {
          [component.label || component.key]: convertAnswer(
            component,
            answers[component.key]
          )
        };
      })
  );
}
