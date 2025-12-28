

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."broker_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "broker" "text" NOT NULL,
    "api_key" "text",
    "secret_key" "text",
    "account_id" "text",
    "username" "text",
    "password" "text",
    "sandbox" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."broker_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_notes" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "trade_id" "uuid",
    "note_content" "text" NOT NULL,
    "tags" "text"[],
    "emotion" character varying(50),
    "pnl" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."journal_notes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."journal_notes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."journal_notes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."journal_notes_id_seq" OWNED BY "public"."journal_notes"."id";



CREATE TABLE IF NOT EXISTS "public"."strategies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."strategies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "symbol" "text" NOT NULL,
    "side" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "price" numeric NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "broker" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "entry_date" timestamp without time zone,
    "pnl" numeric,
    "entrydate" timestamp without time zone,
    "orderid" "text",
    "account" "text",
    "Order ID" "text",
    "B/S" "text",
    "contract" "text",
    "product" "text",
    "Product Description" "text",
    "avgprice" numeric,
    "filledqty" numeric,
    "Fill Time" timestamp with time zone,
    "lastcommandid" "text",
    "status" "text",
    "_priceformat" "text",
    "_priceformattype" "text",
    "_ticksize" numeric,
    "spreaddefinitionid" "text",
    "Version ID" "text",
    "Timestamp" timestamp with time zone,
    "text" "text",
    "type" "text",
    "Limit Price" numeric,
    "Stop Price" numeric,
    "decimallimit" numeric,
    "decimalstop" numeric,
    "Filled Qty" numeric,
    "Avg Fill Price" numeric,
    "decimalfillavg" numeric,
    "orderId" bigint,
    "Account" "text",
    "Contract" "text",
    "Product" "text",
    "avgPrice" numeric(18,8),
    "filledQty" integer,
    "lastCommandId" bigint,
    "Status" "text",
    "_priceFormat" "text",
    "_priceFormatType" "text",
    "_tickSize" numeric(18,8),
    "spreadDefinitionId" bigint,
    "Quantity" integer,
    "Text" "text",
    "Type" "text",
    "decimalLimit" numeric(18,8),
    "decimalStop" numeric(18,8),
    "decimalFillAvg" numeric(18,8),
    "order_id" bigint,
    "bs" "text",
    "product_description" "text",
    "fill_time" timestamp without time zone,
    "version_id" bigint,
    "limit_price" numeric(18,8),
    "stop_price" numeric(18,8),
    "filled_qty" integer,
    "avg_fill_price" numeric(18,8),
    CONSTRAINT "trades_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "trades_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "trades_side_check" CHECK (("side" = ANY (ARRAY['BUY'::"text", 'SELL'::"text"])))
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."journal_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."journal_notes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."broker_connections"
    ADD CONSTRAINT "broker_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_notes"
    ADD CONSTRAINT "journal_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strategies"
    ADD CONSTRAINT "strategies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "handle_broker_connections_updated_at" BEFORE UPDATE ON "public"."broker_connections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_strategies_updated_at" BEFORE UPDATE ON "public"."strategies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_trades_updated_at" BEFORE UPDATE ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."broker_connections"
    ADD CONSTRAINT "broker_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."journal_notes"
    ADD CONSTRAINT "journal_notes_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_notes"
    ADD CONSTRAINT "journal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strategies"
    ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



CREATE POLICY "Users can delete their own broker connections" ON "public"."broker_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own strategies" ON "public"."strategies" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own trades" ON "public"."trades" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own broker connections" ON "public"."broker_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own strategies" ON "public"."strategies" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own trades" ON "public"."trades" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own notes" ON "public"."journal_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own broker connections" ON "public"."broker_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read their own strategies" ON "public"."strategies" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own trades" ON "public"."trades" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own broker connections" ON "public"."broker_connections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own strategies" ON "public"."strategies" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own trades" ON "public"."trades" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."broker_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."strategies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."broker_connections" TO "anon";
GRANT ALL ON TABLE "public"."broker_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."broker_connections" TO "service_role";



GRANT ALL ON TABLE "public"."journal_notes" TO "anon";
GRANT ALL ON TABLE "public"."journal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."journal_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."journal_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."journal_notes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."strategies" TO "anon";
GRANT ALL ON TABLE "public"."strategies" TO "authenticated";
GRANT ALL ON TABLE "public"."strategies" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
