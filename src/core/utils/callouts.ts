import {
  CalloutComponentSchema,
  flattenComponents
} from "@beabee/beabee-common";
import Callout from "@models/Callout";
import {
  CalloutResponseAnswer,
  CalloutResponseAnswers
} from "@models/CalloutResponse";

function getNiceAnswer(
  component: CalloutComponentSchema,
  value: string
): string {
  switch (component.type) {
    case "radio":
    case "selectboxes":
      return component.values.find((v) => v.value === value)?.label || value;
    case "select":
      return (
        component.data.values.find((v) => v.value === value)?.label || value
      );
    default:
      return value;
  }
}

function convertAnswer(
  component: CalloutComponentSchema,
  answer: CalloutResponseAnswer
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
  callout: Callout,
  answers: CalloutResponseAnswers
): Record<string, unknown> {
  const formSchema = callout.formSchema;

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
