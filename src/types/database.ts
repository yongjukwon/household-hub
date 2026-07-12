export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      budget_categories: {
        Row: {
          created_at: string
          household_id: string
          id: string
          monthly_limit: number
          name: string
          page_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          monthly_limit?: number
          name: string
          page_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          monthly_limit?: number
          name?: string
          page_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_categories_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budget_categories_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      budget_entries: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string
          description: string | null
          entry_date: string
          household_id: string
          id: string
          page_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by: string
          description?: string | null
          entry_date?: string
          household_id: string
          id?: string
          page_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          entry_date?: string
          household_id?: string
          id?: string
          page_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budget_entries_category_page_fkey'
            columns: ['category_id', 'page_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'budget_categories'
            referencedColumns: ['id', 'page_id', 'household_id']
          },
          {
            foreignKeyName: 'budget_entries_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'budget_entries_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      grocery_items: {
        Row: {
          checked: boolean
          created_at: string
          household_id: string
          id: string
          last_price: number | null
          name: string
          name_normalized: string | null
          page_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          household_id: string
          id?: string
          last_price?: number | null
          name: string
          name_normalized?: string | null
          page_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          last_price?: number | null
          name?: string
          name_normalized?: string | null
          page_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grocery_items_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grocery_items_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      grocery_price_history: {
        Row: {
          household_id: string
          id: string
          item_name_normalized: string
          page_id: string
          price: number
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          household_id: string
          id?: string
          item_name_normalized: string
          page_id: string
          price: number
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          household_id?: string
          id?: string
          item_name_normalized?: string
          page_id?: string
          price?: number
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grocery_price_history_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grocery_price_history_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          archived: boolean
          content: Json
          created_at: string
          created_by: string
          household_id: string
          id: string
          section: Database['public']['Enums']['page_section']
          template: Database['public']['Enums']['page_template']
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content?: Json
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          section: Database['public']['Enums']['page_section']
          template: Database['public']['Enums']['page_template']
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: Json
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          section?: Database['public']['Enums']['page_section']
          template?: Database['public']['Enums']['page_template']
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pages_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      trip_bookings: {
        Row: {
          address: string | null
          confirmation_number: string | null
          created_at: string
          ends_at: string | null
          household_id: string
          id: string
          notes: string | null
          page_id: string
          sort_order: number
          starts_at: string | null
          title: string
          type: Database['public']['Enums']['booking_type']
          updated_at: string
        }
        Insert: {
          address?: string | null
          confirmation_number?: string | null
          created_at?: string
          ends_at?: string | null
          household_id: string
          id?: string
          notes?: string | null
          page_id: string
          sort_order?: number
          starts_at?: string | null
          title: string
          type: Database['public']['Enums']['booking_type']
          updated_at?: string
        }
        Update: {
          address?: string | null
          confirmation_number?: string | null
          created_at?: string
          ends_at?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          page_id?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          type?: Database['public']['Enums']['booking_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_bookings_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_bookings_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      trip_checklist_items: {
        Row: {
          checked: boolean
          created_at: string
          household_id: string
          id: string
          label: string
          page_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          household_id: string
          id?: string
          label: string
          page_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          page_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_checklist_items_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_checklist_items_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      trip_itinerary_items: {
        Row: {
          created_at: string
          household_id: string
          id: string
          item_date: string
          notes: string | null
          page_id: string
          sort_order: number
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          item_date: string
          notes?: string | null
          page_id: string
          sort_order?: number
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          item_date?: string
          notes?: string | null
          page_id?: string
          sort_order?: number
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_itinerary_items_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_itinerary_items_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
    }
    Enums: {
      booking_type: 'flight' | 'hotel' | 'car' | 'other'
      page_section: 'budget' | 'trip' | 'grocery' | 'notes'
      page_template: 'blank' | 'budget' | 'trip' | 'grocery'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_type: ['flight', 'hotel', 'car', 'other'],
      page_section: ['budget', 'trip', 'grocery', 'notes'],
      page_template: ['blank', 'budget', 'trip', 'grocery'],
    },
  },
} as const
