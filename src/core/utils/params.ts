import _ from "lodash";

export interface SimpleParam {
  name: string;
  label: string;
  type: "number" | "boolean" | "text";
}

export interface SelectParam {
  name: string;
  label: string;
  type: "select";
  values: [string, string][];
}

export type Param = SimpleParam | SelectParam;

export type ParamValue = number | boolean | string | undefined;

interface Paramable {
  getParams?: () => Promise<Param[]>;
}

function getParamValue(param: Param, s: string): ParamValue {
  switch (param.type) {
    case "number":
      return Number(s);
    case "boolean":
      return s === "true";
    case "select":
      return param.values.map(([k]) => k).find((k) => s === k);
    default:
      return s;
  }
}

export async function loadParams<T extends Paramable>(
  item: T
): Promise<T & { params: Param[] }> {
  return {
    ...item,
    params: item.getParams ? await item.getParams() : []
  };
}

export async function parseParams(
  item: Paramable,
  data: Record<string, string>
): Promise<Record<string, ParamValue>> {
  const params = item.getParams ? await item.getParams() : [];
  return _.mapValues(data, (value, paramName) => {
    const param = params.find((p) => p.name === paramName);
    if (param) {
      return getParamValue(param, value);
    }
  });
}
