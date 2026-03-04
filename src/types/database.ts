export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          config: Json
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_references: {
        Row: {
          brand: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          part_id: string
          reference_number: string
          reference_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          part_id: string
          reference_number: string
          reference_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          part_id?: string
          reference_number?: string
          reference_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cross_references_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_references_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          dashboard_id: string
          height: number
          id: string
          position_x: number
          position_y: number
          title: string
          updated_at: string
          widget_type: string
          width: number
        }
        Insert: {
          config?: Json
          created_at?: string
          dashboard_id: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          title: string
          updated_at?: string
          widget_type: string
          width?: number
        }
        Update: {
          config?: Json
          created_at?: string
          dashboard_id?: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          title?: string
          updated_at?: string
          widget_type?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_default: boolean
          layout: Json
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: Json | null
          capacity_sqft: number | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: Json | null
          capacity_sqft?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: Json | null
          capacity_sqft?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          facility_type?: Database["public"]["Enums"]["facility_type"]
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          source_field: string
          target_field: string
          transform_rule: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          source_field: string
          target_field: string
          transform_rule?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          source_field?: string
          target_field?: string
          transform_rule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitments: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          part_id: string
          position: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          part_id: string
          position?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          part_id?: string
          position?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          credentials: Json
          deleted_at: string | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_active: boolean
          last_sync_at: string | null
          name: string
          organization_id: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials?: Json
          deleted_at?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          is_active?: boolean
          last_sync_at?: string | null
          name: string
          organization_id: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          credentials?: Json
          deleted_at?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          is_active?: boolean
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          last_counted_at: string | null
          location_id: string | null
          organization_id: string
          part_id: string
          quantity_on_hand: number
          quantity_on_order: number
          quantity_reserved: number
          reorder_point: number
          reorder_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          last_counted_at?: string | null
          location_id?: string | null
          organization_id: string
          part_id: string
          quantity_on_hand?: number
          quantity_on_order?: number
          quantity_reserved?: number
          reorder_point?: number
          reorder_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          last_counted_at?: string | null
          location_id?: string | null
          organization_id?: string
          part_id?: string
          quantity_on_hand?: number
          quantity_on_order?: number
          quantity_reserved?: number
          reorder_point?: number
          reorder_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          aisle: string | null
          bin: string | null
          created_at: string
          deleted_at: string | null
          facility_id: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          rack: string | null
          shelf: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          aisle?: string | null
          bin?: string | null
          created_at?: string
          deleted_at?: string | null
          facility_id: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          rack?: string | null
          shelf?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          aisle?: string | null
          bin?: string | null
          created_at?: string
          deleted_at?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          rack?: string | null
          shelf?: string | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          created_at: string
          id: string
          kpi_id: string
          metadata: Json
          organization_id: string
          previous_value: number | null
          snapshot_date: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id: string
          metadata?: Json
          organization_id: string
          previous_value?: number | null
          snapshot_date: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string
          metadata?: Json
          organization_id?: string
          previous_value?: number | null
          snapshot_date?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          category: Database["public"]["Enums"]["kpi_category"]
          created_at: string
          critical_threshold: number | null
          description: string | null
          id: string
          is_higher_better: boolean
          key: string
          name: string
          organization_id: string
          target_value: number | null
          unit: string
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["kpi_category"]
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          id?: string
          is_higher_better?: boolean
          key: string
          name: string
          organization_id: string
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["kpi_category"]
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          id?: string
          is_higher_better?: boolean
          key?: string
          name?: string
          organization_id?: string
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          order_id: string
          part_id: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          order_id: string
          part_id: string
          quantity: number
          status?: Database["public"]["Enums"]["order_status"]
          total_cents: number
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          order_id?: string
          part_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          channel_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          customer_email: string | null
          customer_name: string | null
          deleted_at: string | null
          delivered_at: string | null
          facility_id: string | null
          id: string
          notes: string | null
          order_number: string
          organization_id: string
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_address?: Json | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          facility_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          organization_id: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_address?: Json | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          facility_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          organization_id?: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      part_categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "part_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          aces_data: Json | null
          base_price_cents: number
          category_id: string | null
          cost_price_cents: number
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          description: string | null
          height_mm: number | null
          id: string
          image_url: string | null
          is_direct_fit: boolean
          is_universal: boolean
          length_mm: number | null
          material: string | null
          metadata: Json
          name: string
          organization_id: string
          part_number: string
          pies_data: Json | null
          status: Database["public"]["Enums"]["part_status"]
          updated_at: string
          updated_by: string | null
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          aces_data?: Json | null
          base_price_cents?: number
          category_id?: string | null
          cost_price_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          height_mm?: number | null
          id?: string
          image_url?: string | null
          is_direct_fit?: boolean
          is_universal?: boolean
          length_mm?: number | null
          material?: string | null
          metadata?: Json
          name: string
          organization_id: string
          part_number: string
          pies_data?: Json | null
          status?: Database["public"]["Enums"]["part_status"]
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          aces_data?: Json | null
          base_price_cents?: number
          category_id?: string | null
          cost_price_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          height_mm?: number | null
          id?: string
          image_url?: string | null
          is_direct_fit?: boolean
          is_universal?: boolean
          length_mm?: number | null
          material?: string | null
          metadata?: Json
          name?: string
          organization_id?: string
          part_number?: string
          pies_data?: Json | null
          status?: Database["public"]["Enums"]["part_status"]
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "part_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          part_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_cost_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          part_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_cost_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          part_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          expected_delivery_date: string | null
          facility_id: string
          id: string
          notes: string | null
          organization_id: string
          po_number: string
          status: string
          supplier_id: string
          total_amount_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          expected_delivery_date?: string | null
          facility_id: string
          id?: string
          notes?: string | null
          organization_id: string
          po_number: string
          status?: string
          supplier_id: string
          total_amount_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          expected_delivery_date?: string | null
          facility_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          po_number?: string
          status?: string
          supplier_id?: string
          total_amount_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_arrival: string | null
          carrier: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          destination_facility_id: string | null
          estimated_arrival: string | null
          id: string
          latitude: number | null
          longitude: number | null
          order_id: string | null
          organization_id: string
          origin_facility_id: string | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_arrival?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_facility_id?: string | null
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_id?: string | null
          organization_id: string
          origin_facility_id?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_arrival?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination_facility_id?: string | null
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_id?: string | null
          organization_id?: string
          origin_facility_id?: string | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_destination_facility_id_fkey"
            columns: ["destination_facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_origin_facility_id_fkey"
            columns: ["origin_facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supersessions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_date: string | null
          id: string
          new_part_id: string
          old_part_id: string
          organization_id: string
          reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          id?: string
          new_part_id: string
          old_part_id: string
          organization_id: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          id?: string
          new_part_id?: string
          old_part_id?: string
          organization_id?: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supersessions_new_part_id_fkey"
            columns: ["new_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supersessions_old_part_id_fkey"
            columns: ["old_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supersessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          name: string
          organization_id: string
          rating: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: Json | null
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name: string
          organization_id: string
          rating?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: Json | null
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name?: string
          organization_id?: string
          rating?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_chain_alerts: {
        Row: {
          category: Database["public"]["Enums"]["alert_category"]
          created_at: string
          id: string
          is_read: boolean
          is_resolved: boolean
          message: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source_id: string | null
          source_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_id?: string | null
          source_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          message?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_id?: string | null
          source_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_chain_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          direction: string
          error_details: Json | null
          id: string
          integration_id: string
          records_failed: number
          records_processed: number
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          direction?: string
          error_details?: Json | null
          id?: string
          integration_id: string
          records_failed?: number
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          direction?: string
          error_details?: Json | null
          id?: string
          integration_id?: string
          records_failed?: number
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          date_format: string
          default_dashboard_id: string | null
          id: string
          notifications_enabled: boolean
          organization_id: string
          sidebar_collapsed: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_format?: string
          default_dashboard_id?: string | null
          id?: string
          notifications_enabled?: boolean
          organization_id: string
          sidebar_collapsed?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_format?: string
          default_dashboard_id?: string | null
          id?: string
          notifications_enabled?: boolean
          organization_id?: string
          sidebar_collapsed?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_dashboard_id_fkey"
            columns: ["default_dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_organization_id: string | null
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          drive_type: string | null
          engine: string | null
          fuel_type: string | null
          id: string
          make: string
          model: string
          organization_id: string
          trim: string | null
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          body_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          drive_type?: string | null
          engine?: string | null
          fuel_type?: string | null
          id?: string
          make: string
          model: string
          organization_id: string
          trim?: string | null
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          body_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          drive_type?: string | null
          engine?: string | null
          fuel_type?: string | null
          id?: string
          make?: string
          model?: string
          organization_id?: string
          trim?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          deleted_at: string | null
          events: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          organization_id: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          organization_id: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          organization_id?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_org_id: { Args: never; Returns: string }
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_role: {
        Args: { org_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      alert_category:
        | "inventory"
        | "supply_chain"
        | "order"
        | "compliance"
        | "warehouse"
        | "system"
      alert_severity: "info" | "warning" | "critical"
      certification_status:
        | "active"
        | "expiring_soon"
        | "expired"
        | "pending"
        | "revoked"
      channel_type:
        | "wholesale"
        | "direct"
        | "ecommerce_amazon"
        | "ecommerce_ebay"
        | "ecommerce_shopify"
        | "ecommerce_woocommerce"
        | "edi"
        | "phone"
      currency_code: "USD" | "EUR" | "GBP"
      facility_type:
        | "manufacturing_plant"
        | "distribution_center"
        | "warehouse"
        | "cross_dock"
      integration_type:
        | "erp"
        | "ecommerce"
        | "edi"
        | "accounting"
        | "shipping"
        | "custom"
      kpi_category:
        | "revenue"
        | "operations"
        | "inventory"
        | "fulfillment"
        | "compliance"
        | "finance"
        | "warehouse"
      order_status:
        | "draft"
        | "pending"
        | "confirmed"
        | "processing"
        | "picking"
        | "packed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "backordered"
      part_status: "active" | "discontinued" | "pending_approval" | "draft"
      shipment_status:
        | "pending"
        | "in_transit"
        | "at_customs"
        | "out_for_delivery"
        | "delivered"
        | "delayed"
        | "exception"
      sync_status: "pending" | "running" | "completed" | "failed" | "partial"
      user_role:
        | "admin"
        | "ops_director"
        | "catalog_manager"
        | "sales_manager"
        | "compliance_officer"
        | "cfo"
        | "warehouse_supervisor"
        | "executive"
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
  public: {
    Enums: {
      alert_category: [
        "inventory",
        "supply_chain",
        "order",
        "compliance",
        "warehouse",
        "system",
      ],
      alert_severity: ["info", "warning", "critical"],
      certification_status: [
        "active",
        "expiring_soon",
        "expired",
        "pending",
        "revoked",
      ],
      channel_type: [
        "wholesale",
        "direct",
        "ecommerce_amazon",
        "ecommerce_ebay",
        "ecommerce_shopify",
        "ecommerce_woocommerce",
        "edi",
        "phone",
      ],
      currency_code: ["USD", "EUR", "GBP"],
      facility_type: [
        "manufacturing_plant",
        "distribution_center",
        "warehouse",
        "cross_dock",
      ],
      integration_type: [
        "erp",
        "ecommerce",
        "edi",
        "accounting",
        "shipping",
        "custom",
      ],
      kpi_category: [
        "revenue",
        "operations",
        "inventory",
        "fulfillment",
        "compliance",
        "finance",
        "warehouse",
      ],
      order_status: [
        "draft",
        "pending",
        "confirmed",
        "processing",
        "picking",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "backordered",
      ],
      part_status: ["active", "discontinued", "pending_approval", "draft"],
      shipment_status: [
        "pending",
        "in_transit",
        "at_customs",
        "out_for_delivery",
        "delivered",
        "delayed",
        "exception",
      ],
      sync_status: ["pending", "running", "completed", "failed", "partial"],
      user_role: [
        "admin",
        "ops_director",
        "catalog_manager",
        "sales_manager",
        "compliance_officer",
        "cfo",
        "warehouse_supervisor",
        "executive",
      ],
    },
  },
} as const
