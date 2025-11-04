/**
 * JSON Schema to Zod converter for MCP tool schemas
 *
 * Uses @composio/json-schema-to-zod for robust runtime conversion
 * with comprehensive support for nested schemas, constraints, and more.
 */

import { jsonSchemaToZod as convertJsonSchemaToZod } from "@composio/json-schema-to-zod";
import { z } from "zod";

// Re-export types from the library for convenience
export type {
  JsonSchema as JSONSchema,
  JsonSchemaToZodOptions,
} from "@composio/json-schema-to-zod";

export interface ConversionOptions {
  debug?: boolean;
  withoutDefaults?: boolean;
  withoutDescribes?: boolean;
}

export interface ConversionWarning {
  path: string;
  message: string;
}

export interface ConversionResult {
  schema: z.ZodTypeAny;
  warnings: ConversionWarning[];
}

/**
 * Convert a JSON Schema to a Zod schema using the Composio library
 * with added debug logging and error handling
 */
export function jsonSchemaToZod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  options: ConversionOptions = {},
  path = "root",
): ConversionResult {
  const warnings: ConversionWarning[] = [];
  const debug = options.debug ?? false;

  if (debug) {
    console.log(`[DEBUG:SCHEMA_CONVERSION] Converting schema at path: ${path}`);
    console.log(
      `[DEBUG:SCHEMA_CONVERSION] Schema type: ${schema.type || "unknown"}`,
    );
  }

  try {
    // Use the Composio library for conversion
    const zodSchema = convertJsonSchemaToZod(schema, {
      withoutDefaults: options.withoutDefaults,
      withoutDescribes: options.withoutDescribes,
    });

    if (debug) {
      console.log(
        `[DEBUG:SCHEMA_CONVERSION] Successfully converted schema at path: ${path}`,
      );
    }

    return { schema: zodSchema, warnings };
  } catch (error) {
    const message = `Failed to convert schema: ${error instanceof Error ? error.message : String(error)}`;
    warnings.push({ path, message });

    if (debug) {
      console.warn(`[WARN:SCHEMA_CONVERSION] ${path}: ${message}`);
    }

    // Fallback to unknown type
    return { schema: z.unknown(), warnings };
  }
}

/**
 * Get a human-readable summary of a Zod schema
 */
export function getZodSchemaSummary(schema: z.ZodTypeAny): string {
  const typeName = schema._def.typeName;

  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodNull":
      return "null";
    case "ZodUndefined":
      return "undefined";
    case "ZodUnknown":
      return "unknown";
    case "ZodAny":
      return "any";
    case "ZodArray": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arraySchema = schema as z.ZodArray<any>;
      const elementSummary = getZodSchemaSummary(arraySchema.element);
      return `${elementSummary}[]`;
    }
    case "ZodObject": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const objectSchema = schema as z.ZodObject<any>;
      const keys = Object.keys(objectSchema.shape);
      if (keys.length === 0) {
        return "{}";
      }
      if (keys.length <= 3) {
        return `{${keys.join(", ")}}`;
      }
      return `{${keys.slice(0, 3).join(", ")}, ...+${keys.length - 3}}`;
    }
    case "ZodUnion": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unionSchema = schema as z.ZodUnion<any>;
      const options = unionSchema.options.map(getZodSchemaSummary).join(" | ");
      return options;
    }
    case "ZodEnum": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enumSchema = schema as z.ZodEnum<any>;
      return `enum[${enumSchema.options.length}]`;
    }
    case "ZodLiteral": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const literalSchema = schema as z.ZodLiteral<any>;
      return `literal(${JSON.stringify(literalSchema.value)})`;
    }
    case "ZodOptional": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optionalSchema = schema as z.ZodOptional<any>;
      return `${getZodSchemaSummary(optionalSchema.unwrap())}?`;
    }
    case "ZodTuple": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tupleSchema = schema as z.ZodTuple<any>;
      return `[${tupleSchema.items.map(getZodSchemaSummary).join(", ")}]`;
    }
    default:
      return typeName.replace("Zod", "").toLowerCase();
  }
}
