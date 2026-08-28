export interface SqlDialect {
  provider: 'pg' | 'mysql' | 'sqlite';
  
  // Creates a JSON object string expression from key-value pairs (where value is a SQL expression)
  // e.g. jsonBuildObject({ "sessions": "count(*)" }) -> sqlite: json_object('sessions', count(*)), pg: json_build_object('sessions', count(*))
  jsonObject(fields: Record<string, string>): string;
  
  // Aggregates rows into a JSON array
  // e.g. jsonAgg("row_to_json(t)") -> sqlite: json_group_array(json_object(...)), pg: json_agg(...)
  jsonAgg(expression: string): string;
  
  // Gets the exact SQL syntax to cast a timestamp/date to a specific format
  // or extracts a substring to match the 'YYYY-MM-DD HH:00:00' format
  formatDate(column: string, bucket: 'hour' | 'day'): string;

  // The actual JSON output might be a string in some dialects (like SQLite via LibSQL)
  // this helper tells the builder if it needs to parse it on the JS side
  requiresJsonParse: boolean;
}

export class PgDialect implements SqlDialect {
  provider = 'pg' as const;
  requiresJsonParse = false; // pg usually returns actual json objects in most drivers

  jsonObject(fields: Record<string, string>): string {
    const parts = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`);
    return `json_build_object(${parts.join(', ')})`;
  }

  jsonAgg(expression: string): string {
    return `COALESCE(json_agg(${expression}), '[]'::json)`;
  }

  formatDate(column: string, bucket: 'hour' | 'day'): string {
    // PG has date_trunc but for string format 'YYYY-MM-DD HH:00:00' or similar
    // to_char(date_trunc('hour', started_at), 'YYYY-MM-DD HH24:00:00')
    if (bucket === 'hour') {
      return `to_char(date_trunc('hour', ${column}), 'YYYY-MM-DD HH24:00:00')`;
    }
    return `to_char(date_trunc('day', ${column}), 'YYYY-MM-DD 00:00:00')`;
  }
}

export class SqliteDialect implements SqlDialect {
  provider = 'sqlite' as const;
  requiresJsonParse = true;

  jsonObject(fields: Record<string, string>): string {
    const parts = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`);
    return `json_object(${parts.join(', ')})`;
  }

  jsonAgg(expression: string): string {
    return `COALESCE(json_group_array(${expression}), '[]')`;
  }

  formatDate(column: string, bucket: 'hour' | 'day'): string {
    // SQLite: we cast to text (YYYY-MM-DD HH:MM:SS.SSS) and substr
    if (bucket === 'hour') {
      return `substr(cast(${column} as text), 1, 13) || ':00:00'`;
    }
    return `substr(cast(${column} as text), 1, 10) || ' 00:00:00'`;
  }
}

export class MysqlDialect implements SqlDialect {
  provider = 'mysql' as const;
  requiresJsonParse = false;

  jsonObject(fields: Record<string, string>): string {
    const parts = Object.entries(fields).map(([k, v]) => `'${k}', ${v}`);
    return `JSON_OBJECT(${parts.join(', ')})`;
  }

  jsonAgg(expression: string): string {
    return `COALESCE(JSON_ARRAYAGG(${expression}), JSON_ARRAY())`;
  }

  formatDate(column: string, bucket: 'hour' | 'day'): string {
    if (bucket === 'hour') {
      return `DATE_FORMAT(${column}, '%Y-%m-%d %H:00:00')`;
    }
    return `DATE_FORMAT(${column}, '%Y-%m-%d 00:00:00')`;
  }
}

export function createDialect(provider: 'pg' | 'mysql' | 'sqlite'): SqlDialect {
  switch (provider) {
    case 'pg': return new PgDialect();
    case 'mysql': return new MysqlDialect();
    case 'sqlite': return new SqliteDialect();
    default: throw new Error(`Unsupported SQL provider: ${provider}`);
  }
}
