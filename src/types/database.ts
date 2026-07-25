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
      asset_postings: {
        Row: {
          amount_cents: number
          asset_id: string
          created_at: string
          effect_id: string
          effect_type: string
          household_id: string
          id: string
          leg: string
          occurred_at: string
          operation_id: string
        }
        Insert: {
          amount_cents: number
          asset_id: string
          created_at?: string
          effect_id: string
          effect_type: string
          household_id: string
          id?: string
          leg: string
          occurred_at: string
          operation_id: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string
          created_at?: string
          effect_id?: string
          effect_type?: string
          household_id?: string
          id?: string
          leg?: string
          occurred_at?: string
          operation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_postings_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "asset_postings_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "asset_postings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
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
            foreignKeyName: "budget_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_category_limits: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          household_id: string
          id: string
          month: string
          page_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          month: string
          page_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          month?: string
          page_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_category_limits_category_page_fkey"
            columns: ["category_id", "page_id", "household_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id", "page_id", "household_id"]
          },
          {
            foreignKeyName: "budget_category_limits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_category_limits_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
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
            foreignKeyName: "budget_entries_category_page_fkey"
            columns: ["category_id", "page_id", "household_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id", "page_id", "household_id"]
          },
          {
            foreignKeyName: "budget_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_entries_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_reminders: {
        Row: {
          created_at: string
          event_id: string
          household_id: string
          id: string
          preset: string
          revision: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          household_id: string
          id?: string
          preset: string
          revision?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          household_id?: string
          id?: string
          preset?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_reminders_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_event_reminders_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string
          end_at: string | null
          end_date: string | null
          event_timezone: string
          household_id: string
          id: string
          note: string | null
          owner_id: string | null
          recurrence_freq: Database["public"]["Enums"]["calendar_recurrence_freq"]
          recurrence_until: string | null
          revision: number
          start_at: string | null
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by: string
          end_at?: string | null
          end_date?: string | null
          event_timezone: string
          household_id: string
          id?: string
          note?: string | null
          owner_id?: string | null
          recurrence_freq?: Database["public"]["Enums"]["calendar_recurrence_freq"]
          recurrence_until?: string | null
          revision?: number
          start_at?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string
          end_at?: string | null
          end_date?: string | null
          event_timezone?: string
          household_id?: string
          id?: string
          note?: string | null
          owner_id?: string | null
          recurrence_freq?: Database["public"]["Enums"]["calendar_recurrence_freq"]
          recurrence_until?: string | null
          revision?: number
          start_at?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_reminder_dispatches: {
        Row: {
          dispatched_at: string
          event_id: string
          fire_at: string
          household_id: string
          id: string
          occurrence_start: string
          preset: string
        }
        Insert: {
          dispatched_at?: string
          event_id: string
          fire_at: string
          household_id: string
          id?: string
          occurrence_start: string
          preset: string
        }
        Update: {
          dispatched_at?: string
          event_id?: string
          fire_at?: string
          household_id?: string
          id?: string
          occurrence_start?: string
          preset?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminder_dispatches_event_id_household_id_fkey"
            columns: ["event_id", "household_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "calendar_reminder_dispatches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
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
            foreignKeyName: "grocery_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_price_history: {
        Row: {
          household_id: string
          id: string
          item_name: string | null
          item_name_normalized: string
          page_id: string
          price: number
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          household_id: string
          id?: string
          item_name?: string | null
          item_name_normalized: string
          page_id: string
          price: number
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          household_id?: string
          id?: string
          item_name?: string | null
          item_name_normalized?: string
          page_id?: string
          price?: number
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_price_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_price_history_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      household_change_log: {
        Row: {
          change_kind: string
          changed_at: string
          entity_id: string
          entity_revision: number
          entity_type: string
          household_id: string
          id: string
          operation_id: string
          operation_type: string
          server_sequence: number
        }
        Insert: {
          change_kind: string
          changed_at?: string
          entity_id: string
          entity_revision: number
          entity_type: string
          household_id: string
          id?: string
          operation_id: string
          operation_type: string
          server_sequence: number
        }
        Update: {
          change_kind?: string
          changed_at?: string
          entity_id?: string
          entity_revision?: number
          entity_type?: string
          household_id?: string
          id?: string
          operation_id?: string
          operation_type?: string
          server_sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_change_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_entity_revisions: {
        Row: {
          applied_at: string
          deleted: boolean
          entity_id: string
          entity_type: string
          household_id: string
          last_operation_id: string
          revision: number
          winner_entity_id: string
          winner_entity_type: string
          winner_type: string
        }
        Insert: {
          applied_at: string
          deleted?: boolean
          entity_id: string
          entity_type: string
          household_id: string
          last_operation_id: string
          revision: number
          winner_entity_id: string
          winner_entity_type: string
          winner_type: string
        }
        Update: {
          applied_at?: string
          deleted?: boolean
          entity_id?: string
          entity_type?: string
          household_id?: string
          last_operation_id?: string
          revision?: number
          winner_entity_id?: string
          winner_entity_type?: string
          winner_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_entity_revisions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_grocery_items: {
        Row: {
          checked: boolean
          created_at: string
          created_by: string
          household_id: string
          id: string
          list_id: string
          name: string
          name_normalized: string | null
          quantity: string | null
          revision: number
          sort_order: number
          unit_price_cents: number | null
          updated_at: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          created_by: string
          household_id: string
          id: string
          list_id: string
          name: string
          name_normalized?: string | null
          quantity?: string | null
          revision?: number
          sort_order?: number
          unit_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          list_id?: string
          name?: string
          name_normalized?: string | null
          quantity?: string | null
          revision?: number
          sort_order?: number
          unit_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_grocery_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_grocery_items_list_id_household_id_fkey"
            columns: ["list_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_grocery_lists"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_grocery_lists: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          name: string
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id: string
          name: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          name?: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_grocery_lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_grocery_price_history: {
        Row: {
          household_id: string
          id: string
          item_name: string
          item_name_normalized: string
          list_id: string
          price_cents: number
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          household_id: string
          id?: string
          item_name: string
          item_name_normalized: string
          list_id: string
          price_cents: number
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          household_id?: string
          id?: string
          item_name?: string
          item_name_normalized?: string
          list_id?: string
          price_cents?: number
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_grocery_price_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_grocery_price_history_list_id_household_id_fkey"
            columns: ["list_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_grocery_lists"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      household_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          revision: number
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          household_id: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revision?: number
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revision?: number
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          member_role: string
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          member_role?: string
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          member_role?: string
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_notes: {
        Row: {
          created_at: string
          created_by: string
          document: Json
          household_id: string
          id: string
          revision: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document: Json
          household_id: string
          id: string
          revision?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document?: Json
          household_id?: string
          id?: string
          revision?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_tombstones: {
        Row: {
          deleted_at: string
          entity_id: string
          entity_type: string
          household_id: string
          id: string
          operation_id: string
          revision: number
        }
        Insert: {
          deleted_at?: string
          entity_id: string
          entity_type: string
          household_id: string
          id?: string
          operation_id: string
          revision: number
        }
        Update: {
          deleted_at?: string
          entity_id?: string
          entity_type?: string
          household_id?: string
          id?: string
          operation_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_tombstones_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_trips: {
        Row: {
          created_at: string
          created_by: string
          destination: string
          destination_currency: string
          destination_timezone: string
          end_date: string
          household_id: string
          id: string
          name: string
          revision: number
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          destination: string
          destination_currency: string
          destination_timezone: string
          end_date: string
          household_id: string
          id: string
          name: string
          revision?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          destination?: string
          destination_currency?: string
          destination_timezone?: string
          end_date?: string
          household_id?: string
          id?: string
          name?: string
          revision?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_trips_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          revision: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          revision?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
      ledger_assets: {
        Row: {
          created_at: string
          created_by: string
          currency_code: string
          household_id: string
          id: string
          kind: string
          name: string
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency_code: string
          household_id: string
          id: string
          kind: string
          name: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency_code?: string
          household_id?: string
          id?: string
          kind?: string
          name?: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_assets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_categories: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          kind: string
          revision: number
          system_key: string | null
          updated_at: string
          year_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id: string
          kind: string
          revision?: number
          system_key?: string | null
          updated_at?: string
          year_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          kind?: string
          revision?: number
          system_key?: string | null
          updated_at?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_categories_year_id_household_id_fkey"
            columns: ["year_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_years"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_month_categories: {
        Row: {
          category_id: string
          created_at: string
          household_id: string
          id: string
          month_id: string
          name: string
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          month_id: string
          name: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          month_id?: string
          name?: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_month_categories_category_id_household_id_fkey"
            columns: ["category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_categories"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_month_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_month_categories_month_id_household_id_fkey"
            columns: ["month_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_months"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_month_limits: {
        Row: {
          amount_cents: number | null
          category_id: string
          created_at: string
          household_id: string
          id: string
          limit_entity_id: string
          month_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          limit_entity_id: string
          month_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          limit_entity_id?: string
          month_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_month_limits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_month_limits_month_id_category_id_household_id_fkey"
            columns: ["month_id", "category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_month_categories"
            referencedColumns: ["month_id", "category_id", "household_id"]
          },
        ]
      }
      ledger_months: {
        Row: {
          created_at: string
          household_id: string
          id: string
          month: number
          revision: number
          updated_at: string
          year_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          month: number
          revision?: number
          updated_at?: string
          year_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          month?: number
          revision?: number
          updated_at?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_months_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_months_year_id_household_id_fkey"
            columns: ["year_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_years"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount_cents: number
          asset_id: string
          category_id: string
          created_at: string
          created_by: string
          description: string
          household_id: string
          id: string
          kind: string
          month_id: string
          occurred_at: string
          revision: number
          trip_expense_id: string | null
          updated_at: string
          year_id: string
        }
        Insert: {
          amount_cents: number
          asset_id: string
          category_id: string
          created_at?: string
          created_by: string
          description: string
          household_id: string
          id: string
          kind: string
          month_id: string
          occurred_at: string
          revision?: number
          trip_expense_id?: string | null
          updated_at?: string
          year_id: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string
          household_id?: string
          id?: string
          kind?: string
          month_id?: string
          occurred_at?: string
          revision?: number
          trip_expense_id?: string | null
          updated_at?: string
          year_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_category_id_household_id_fkey"
            columns: ["category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_categories"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_month_id_category_id_household_id_fkey"
            columns: ["month_id", "category_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_month_categories"
            referencedColumns: ["month_id", "category_id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_month_id_year_id_household_id_fkey"
            columns: ["month_id", "year_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_months"
            referencedColumns: ["id", "year_id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_trip_expense_id_household_id_fkey"
            columns: ["trip_expense_id", "household_id"]
            isOneToOne: false
            referencedRelation: "trip_expenses"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transactions_year_id_household_id_fkey"
            columns: ["year_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_years"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_transfer_schedules: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          created_by: string
          frequency: string
          from_asset_id: string
          household_id: string
          id: string
          revision: number
          starts_at: string
          timezone: string
          to_asset_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          created_by: string
          frequency: string
          from_asset_id: string
          household_id: string
          id: string
          revision?: number
          starts_at: string
          timezone: string
          to_asset_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          created_by?: string
          frequency?: string
          from_asset_id?: string
          household_id?: string
          id?: string
          revision?: number
          starts_at?: string
          timezone?: string
          to_asset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transfer_schedules_from_asset_id_household_id_fkey"
            columns: ["from_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfer_schedules_from_asset_id_household_id_fkey"
            columns: ["from_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfer_schedules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transfer_schedules_to_asset_id_household_id_fkey"
            columns: ["to_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfer_schedules_to_asset_id_household_id_fkey"
            columns: ["to_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_transfers: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          from_asset_id: string
          household_id: string
          id: string
          note: string | null
          occurred_at: string
          occurrence_date: string | null
          revision: number
          schedule_id: string | null
          to_asset_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by: string
          from_asset_id: string
          household_id: string
          id: string
          note?: string | null
          occurred_at: string
          occurrence_date?: string | null
          revision?: number
          schedule_id?: string | null
          to_asset_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          from_asset_id?: string
          household_id?: string
          id?: string
          note?: string | null
          occurred_at?: string
          occurrence_date?: string | null
          revision?: number
          schedule_id?: string | null
          to_asset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transfers_from_asset_id_household_id_fkey"
            columns: ["from_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfers_from_asset_id_household_id_fkey"
            columns: ["from_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transfers_schedule_id_household_id_fkey"
            columns: ["schedule_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_transfer_schedules"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfers_to_asset_id_household_id_fkey"
            columns: ["to_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "ledger_transfers_to_asset_id_household_id_fkey"
            columns: ["to_asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      ledger_years: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          revision: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id: string
          revision?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          revision?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ledger_years_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_devices: {
        Row: {
          created_at: string
          device_id: string
          disabled_at: string | null
          expo_push_token: string
          failure_count: number
          household_id: string
          id: string
          last_seen_at: string
          platform: string
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          disabled_at?: string | null
          expo_push_token: string
          failure_count?: number
          household_id: string
          id?: string
          last_seen_at?: string
          platform: string
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          disabled_at?: string | null
          expo_push_token?: string
          failure_count?: number
          household_id?: string
          id?: string
          last_seen_at?: string
          platform?: string
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_devices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_deliveries: {
        Row: {
          attempted_at: string
          device_row_id: string
          error_code: string | null
          expo_receipt_id: string | null
          household_id: string
          id: string
          notification_id: string
          status: string
        }
        Insert: {
          attempted_at?: string
          device_row_id: string
          error_code?: string | null
          expo_receipt_id?: string | null
          household_id: string
          id?: string
          notification_id: string
          status: string
        }
        Update: {
          attempted_at?: string
          device_row_id?: string
          error_code?: string | null
          expo_receipt_id?: string | null
          household_id?: string
          id?: string
          notification_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_deliveries_device_row_id_fkey"
            columns: ["device_row_id"]
            isOneToOne: false
            referencedRelation: "notification_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_notification_id_household_id_fkey"
            columns: ["notification_id", "household_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          household_id: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          household_id: string
          id: string
          kind: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          household_id?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_receipts: {
        Row: {
          actor_user_id: string
          command_hash: string
          created_at: string
          device_id: string
          household_id: string
          local_sequence: number
          operation_id: string
          result: Json
          server_sequence: number | null
          status: string
        }
        Insert: {
          actor_user_id: string
          command_hash: string
          created_at?: string
          device_id: string
          household_id: string
          local_sequence: number
          operation_id: string
          result: Json
          server_sequence?: number | null
          status: string
        }
        Update: {
          actor_user_id?: string
          command_hash?: string
          created_at?: string
          device_id?: string
          household_id?: string
          local_sequence?: number
          operation_id?: string
          result?: Json
          server_sequence?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_receipts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          archived: boolean
          content: Json
          created_at: string
          created_by: string
          end_date: string | null
          household_id: string
          id: string
          section: Database["public"]["Enums"]["page_section"]
          start_date: string | null
          template: Database["public"]["Enums"]["page_template"]
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content?: Json
          created_at?: string
          created_by: string
          end_date?: string | null
          household_id: string
          id?: string
          section: Database["public"]["Enums"]["page_section"]
          start_date?: string | null
          template: Database["public"]["Enums"]["page_template"]
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: Json
          created_at?: string
          created_by?: string
          end_date?: string | null
          household_id?: string
          id?: string
          section?: Database["public"]["Enums"]["page_section"]
          start_date?: string | null
          template?: Database["public"]["Enums"]["page_template"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          appearance: string
          avatar_url: string | null
          created_at: string
          display_name: string
          notifications_enabled: boolean
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          appearance?: string
          avatar_url?: string | null
          created_at?: string
          display_name: string
          notifications_enabled?: boolean
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          appearance?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          notifications_enabled?: boolean
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_deposit_rules: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          day_of_month_1: number
          day_of_month_2: number
          description: string | null
          household_id: string
          id: string
          last_generated_date: string | null
          source_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          day_of_month_1: number
          day_of_month_2: number
          description?: string | null
          household_id: string
          id?: string
          last_generated_date?: string | null
          source_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          day_of_month_1?: number
          day_of_month_2?: number
          description?: string | null
          household_id?: string
          id?: string
          last_generated_date?: string | null
          source_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_deposit_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_deposit_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "savings_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_sources: {
        Row: {
          amount: number
          created_at: string
          household_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          household_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_sources_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_transactions: {
        Row: {
          amount: number
          auto_deposit_rule_id: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          occurred_at: string
          reason: string | null
          source_id: string
          type: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          auto_deposit_rule_id?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          occurred_at?: string
          reason?: string | null
          source_id: string
          type: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          auto_deposit_rule_id?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          occurred_at?: string
          reason?: string | null
          source_id?: string
          type?: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_auto_deposit_rule_id_fkey"
            columns: ["auto_deposit_rule_id"]
            isOneToOne: false
            referencedRelation: "savings_deposit_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "savings_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_bookings: {
        Row: {
          address: string | null
          confirmation_number: string | null
          confirmation_url: string | null
          created_at: string
          ends_at: string | null
          household_id: string
          id: string
          notes: string | null
          page_id: string
          sort_order: number
          starts_at: string | null
          title: string
          type: Database["public"]["Enums"]["booking_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          confirmation_number?: string | null
          confirmation_url?: string | null
          created_at?: string
          ends_at?: string | null
          household_id: string
          id?: string
          notes?: string | null
          page_id: string
          sort_order?: number
          starts_at?: string | null
          title: string
          type: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          confirmation_number?: string | null
          confirmation_url?: string | null
          created_at?: string
          ends_at?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          page_id?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_bookings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_bookings_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
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
            foreignKeyName: "trip_checklist_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_checklist_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          amount_cents: number
          asset_id: string
          created_at: string
          created_by: string
          currency_code: string
          description: string
          household_id: string
          id: string
          ledger_transaction_id: string | null
          revision: number
          spent_at: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asset_id: string
          created_at?: string
          created_by: string
          currency_code: string
          description: string
          household_id: string
          id: string
          ledger_transaction_id?: string | null
          revision?: number
          spent_at: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          description?: string
          household_id?: string
          id?: string
          ledger_transaction_id?: string | null
          revision?: number
          spent_at?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_asset_balances"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "trip_expenses_asset_id_household_id_fkey"
            columns: ["asset_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_assets"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "trip_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_ledger_transaction_fkey"
            columns: ["ledger_transaction_id", "household_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id", "household_id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_household_id_fkey"
            columns: ["trip_id", "household_id"]
            isOneToOne: false
            referencedRelation: "household_trips"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
      trip_itinerary_items: {
        Row: {
          close_time: string | null
          created_at: string
          household_id: string
          id: string
          item_date: string
          map_url: string | null
          notes: string | null
          open_time: string | null
          page_id: string
          sort_order: number
          ticket_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          household_id: string
          id?: string
          item_date: string
          map_url?: string | null
          notes?: string | null
          open_time?: string | null
          page_id: string
          sort_order?: number
          ticket_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          household_id?: string
          id?: string
          item_date?: string
          map_url?: string | null
          notes?: string | null
          open_time?: string | null
          page_id?: string
          sort_order?: number
          ticket_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_itinerary_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ledger_asset_balances: {
        Row: {
          balance_cents: number | null
          created_at: string | null
          created_by: string | null
          currency_code: string | null
          household_id: string | null
          id: string | null
          kind: string | null
          name: string | null
          revision: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_assets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_prepare_account_deletion: {
        Args: { target_user_id: string }
        Returns: Json
      }
      apply_household_operation: { Args: { command: Json }; Returns: Json }
      create_household_invite: { Args: never; Returns: Json }
      delete_household: { Args: never; Returns: Json }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      job_active_transfer_schedules: { Args: never; Returns: Json }
      job_calendar_reminder_candidates: {
        Args: { window_end: string; window_start: string }
        Returns: Json
      }
      job_cleanup_read_notifications: {
        Args: { ttl_days?: number }
        Returns: Json
      }
      job_disable_notification_device: {
        Args: { failure_code: string; target_device_row_id: string }
        Returns: Json
      }
      job_execute_transfer_occurrence: {
        Args: {
          target_occurred_at: string
          target_occurrence_date: string
          target_schedule_id: string
        }
        Returns: Json
      }
      job_pending_push_notifications: {
        Args: { max_notifications?: number }
        Returns: Json
      }
      job_record_calendar_reminder: {
        Args: {
          target_event_id: string
          target_fire_at: string
          target_household_id: string
          target_occurrence_start: string
          target_preset: string
        }
        Returns: Json
      }
      job_record_push_delivery: {
        Args: {
          delivery_status: string
          failure_code?: string
          receipt_id?: string
          target_device_row_id: string
          target_notification_id: string
        }
        Returns: Json
      }
      mobile_add_posting: {
        Args: {
          target_amount_cents: number
          target_asset_id: string
          target_effect_id: string
          target_effect_type: string
          target_household_id: string
          target_leg: string
          target_occurred_at: string
          target_operation_id: string
        }
        Returns: undefined
      }
      mobile_admin_rejected: {
        Args: { code: string; details?: Json; reason: string }
        Returns: Json
      }
      mobile_asset_balance: {
        Args: { target_asset_id: string }
        Returns: number
      }
      mobile_ensure_ledger_year: {
        Args: {
          actor_user_id: string
          source_applied_at: string
          source_entity_id: string
          source_entity_type: string
          source_operation_id: string
          source_operation_type: string
          target_household_id: string
          target_year: number
        }
        Returns: string
      }
      mobile_ensure_travel_category: {
        Args: {
          actor_user_id: string
          source_applied_at: string
          source_entity_id: string
          source_entity_type: string
          source_operation_id: string
          source_operation_type: string
          target_household_id: string
          target_year_id: string
        }
        Returns: string
      }
      mobile_expected_entity_type: {
        Args: { operation_type: string }
        Returns: string
      }
      mobile_is_iana_timezone: { Args: { candidate: string }; Returns: boolean }
      mobile_is_iso_currency_code: {
        Args: { candidate: string }
        Returns: boolean
      }
      mobile_is_iso_date: { Args: { candidate: string }; Returns: boolean }
      mobile_is_iso_instant: { Args: { candidate: string }; Returns: boolean }
      mobile_json_is_integer: {
        Args: { candidate: Json; maximum_value: number; minimum_value: number }
        Returns: boolean
      }
      mobile_json_is_uuid: { Args: { candidate: Json }; Returns: boolean }
      mobile_json_keys_valid: {
        Args: {
          candidate: Json
          optional_keys?: string[]
          required_keys: string[]
        }
        Returns: boolean
      }
      mobile_note_node_valid: {
        Args: { expected_type?: string; node: Json }
        Returns: boolean
      }
      mobile_operation_payload_valid: {
        Args: { operation_type: string; payload: Json }
        Returns: boolean
      }
      mobile_reassign_authorship: {
        Args: { from_user_id: string; to_user_id: string }
        Returns: undefined
      }
      mobile_record_cascade_deletion: {
        Args: {
          source_revision: number
          target_applied_at: string
          target_entity_id: string
          target_entity_type: string
          target_household_id: string
          target_operation_id: string
          winning_entity_id: string
          winning_entity_type: string
          winning_operation_type: string
        }
        Returns: undefined
      }
      mobile_record_cascade_update: {
        Args: {
          source_revision: number
          target_applied_at: string
          target_entity_id: string
          target_entity_type: string
          target_household_id: string
          target_operation_id: string
          winning_entity_id: string
          winning_entity_type: string
          winning_operation_type: string
        }
        Returns: number
      }
      mobile_rejected_result: {
        Args: {
          operation_id: string
          rejection_code: string
          rejection_details?: Json
          rejection_reason: string
          rejection_warnings?: Json
        }
        Returns: Json
      }
      mobile_store_rejection: {
        Args: {
          actor_user_id: string
          rejection_code: string
          rejection_details?: Json
          rejection_reason: string
          rejection_warnings?: Json
          target_command_hash: string
          target_device_id: string
          target_household_id: string
          target_local_sequence: number
          target_operation_id: string
        }
        Returns: Json
      }
      onboard_household: {
        Args: { display_name: string; household_name: string }
        Returns: Json
      }
      redeem_household_invite: {
        Args: { code: string; display_name: string }
        Returns: Json
      }
      register_notification_device: {
        Args: {
          target_device_id: string
          target_platform: string
          target_push_token: string
        }
        Returns: Json
      }
      remove_household_member: {
        Args: { target_user_id: string }
        Returns: Json
      }
      revoke_household_invite: { Args: { invite_id: string }; Returns: Json }
      transfer_household_ownership: {
        Args: { target_user_id: string }
        Returns: Json
      }
      unregister_notification_device: {
        Args: { target_device_id: string }
        Returns: Json
      }
      update_user_settings: {
        Args: {
          target_appearance: string
          target_notifications_enabled: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      booking_type: "flight" | "hotel" | "car" | "other"
      calendar_recurrence_freq:
        | "none"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
      page_section: "budget" | "trip" | "grocery" | "notes"
      page_template: "blank" | "budget" | "trip" | "grocery"
      savings_transaction_type: "deposit" | "withdrawal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_type: ["flight", "hotel", "car", "other"],
      calendar_recurrence_freq: [
        "none",
        "daily",
        "weekly",
        "monthly",
        "yearly",
      ],
      page_section: ["budget", "trip", "grocery", "notes"],
      page_template: ["blank", "budget", "trip", "grocery"],
      savings_transaction_type: ["deposit", "withdrawal"],
    },
  },
} as const

