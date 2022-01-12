import Poll from "@models/Poll";
import { PollResponseAnswer, PollResponseAnswers } from "@models/PollResponse";

interface ComponentSchema {
  key: string;
  type: string;
  label?: string;
  input?: boolean;
  values?: { label: string; value: string }[];
  components?: ComponentSchema[];
}

interface FormSchema {
  components: ComponentSchema[];
}

function flattenComponents(components: ComponentSchema[]): ComponentSchema[] {
  return components.flatMap((component) => [
    component,
    ...flattenComponents(component.components || [])
  ]);
}

function getNiceAnswer(component: ComponentSchema, value: string): string {
  return component.values?.find((v) => v.value === value)?.label || value;
}

function convertAnswer(
  component: ComponentSchema,
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

  const formSchema = poll.templateSchema.formSchema as FormSchema;

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
